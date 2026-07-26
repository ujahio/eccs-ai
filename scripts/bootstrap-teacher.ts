import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminDeleteUserCommand,
	AdminEnableUserCommand,
	AdminGetUserCommand,
	AdminListGroupsForUserCommand,
	AdminSetUserPasswordCommand,
	AdminUpdateUserAttributesCommand,
	CognitoIdentityProviderClient,
	paginateListUsers,
	paginateListUsersInGroup,
	type AdminGetUserCommandOutput,
	type AttributeType,
	type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	paginateQuery,
	PutCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import {
	failedPasswordRequirements,
	passwordRequirementMessage,
} from "../src/features/auth/registration/schema";

type BootstrapResources = {
	AuthUserPool: { id: string };
	UserProfileTable: { name: string };
};

export type TeacherProfileRecord = {
	profileId: string;
	emailNormalized: string;
	firstName: string;
	lastName: string;
	fullName: string;
	role: string;
	emailVerifiedAt: number;
	pendingEmail?: string;
	pendingEmailVerificationTokenHash?: string;
	pendingEmailVerificationExpiresAt?: number;
	pendingEmailVerificationRequestedAt?: number;
	createdAt: number;
	updatedAt: number;
	sessionsInvalidatedAt?: number;
	sessionInvalidationExemptToken?: string;
};

type ParsedArgs = {
	email: string;
	firstName: string;
	lastName: string;
	apply: boolean;
	replaceExistingTestTeacher: boolean;
	resetTemporaryPassword: boolean;
	passwordEnv: string;
	permanentPasswordEnv: string | null;
	testTeacherMailboxEnv: string;
	help: boolean;
};

export type CognitoUserState = {
	username: string;
	sub: string;
	enabled: boolean;
	status?: string;
	attributes: Record<string, string>;
	groups: string[];
};

type DesiredTeacherState = {
	emailNormalized: string;
	firstName: string;
	lastName: string;
	fullName: string;
};

type BootstrapContext = {
	userPoolId: string;
	userProfileTableName: string;
	cognito: CognitoIdentityProviderClient;
	dynamo: DynamoDBDocumentClient;
};

type BootstrapState = {
	existingUser: CognitoUserState | null;
	existingProfilesForEmail: TeacherProfileRecord[];
	duplicateProfilesForEmail: TeacherProfileRecord[];
	existingProfile: TeacherProfileRecord | null;
	teacherProfiles: TeacherProfileRecord[];
	teacherUsers: CognitoUserState[];
	mismatchedEmailProfiles: TeacherProfileRecord[];
};

type TestTeacherReplacementTargets = {
	cognitoUsers: CognitoUserState[];
	profiles: TeacherProfileRecord[];
};

const TEACHER_GROUP = "teacher";
const STUDENT_GROUP = "student";
const DEFAULT_PASSWORD_ENV = "TEACHER_TEMP_PASSWORD";
const DEFAULT_PERMANENT_PASSWORD_ENV = "TEACHER_PASSWORD";
const DEFAULT_TEST_TEACHER_MAILBOX_ENV = "SMOKE_TEST_MAILBOX";
const FIRST_LOGIN_PASSWORD_CHANGE_STATUS = "FORCE_CHANGE_PASSWORD";

export async function main(argv = process.argv.slice(2)) {
	const args = parseArgs(argv);

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	const desired = {
		emailNormalized: normalizeEmail(args.email),
		firstName: args.firstName.trim(),
		lastName: args.lastName.trim(),
		fullName: `${args.firstName.trim()} ${args.lastName.trim()}`,
	};

	validateRequired("email", desired.emailNormalized);
	validateRequired("first-name", desired.firstName);
	validateRequired("last-name", desired.lastName);

	const context = createBootstrapContext();
	const testTeacherMailbox = args.replaceExistingTestTeacher
		? readTestTeacherMailbox(args.testTeacherMailboxEnv)
		: null;

	let state = await loadBootstrapState(context, desired.emailNormalized);
	const testTeacherUsers = testTeacherMailbox
		? await listTestTeacherUsers(context, testTeacherMailbox)
		: [];
	const replacementTargets = args.replaceExistingTestTeacher
		? getTestTeacherReplacementTargets({
				existingUser: state.existingUser,
				testTeacherMailbox,
				testTeacherUsers,
				teacherProfiles: state.teacherProfiles,
				teacherUsers: state.teacherUsers,
			})
		: emptyTestTeacherReplacementTargets();
	const replacementBlocker = args.replaceExistingTestTeacher
			? getTestTeacherReplacementBlocker({
					desiredEmailNormalized: desired.emailNormalized,
					testTeacherMailbox,
					testTeacherUsers,
					teacherProfiles: state.teacherProfiles,
					teacherUsers: state.teacherUsers,
				})
		: null;

	if (replacementBlocker) {
		fail(replacementBlocker);
	}

	if (hasTestTeacherReplacementTargets(replacementTargets)) {
		state = removeTestTeacherReplacementTargets(state, replacementTargets);
	}

	let {
		existingUser,
		duplicateProfilesForEmail,
		existingProfile,
		teacherProfiles,
		teacherUsers,
		mismatchedEmailProfiles,
	} = state;

	const singleTeacherBlocker = getSingleTeacherIdentityBlocker({
		desiredEmailNormalized: desired.emailNormalized,
		existingUser,
		teacherProfiles,
		teacherUsers,
	});

	if (singleTeacherBlocker) {
		fail(singleTeacherBlocker);
	}

	if (!existingUser && duplicateProfilesForEmail.length > 0) {
		fail(
			`Refusing to create Cognito user because UserProfileTable already has ${duplicateProfilesForEmail.length} profile record(s) for ${desired.emailNormalized}. Resolve the profile conflict first.`,
		);
	}

	if (existingUser?.groups.includes(STUDENT_GROUP)) {
		fail(
			`Refusing to bootstrap ${desired.emailNormalized} because the existing Cognito user is already in the ${STUDENT_GROUP} group. Remove or choose the correct account before creating a teacher identity.`,
		);
	}

	if (existingProfile && existingProfile.role !== TEACHER_GROUP) {
		fail(
			`Refusing to bootstrap ${desired.emailNormalized} because the existing UserProfileTable record ${existingProfile.profileId} has role ${existingProfile.role}. Teacher bootstrap will not promote an existing non-teacher profile.`,
		);
	}

	if (mismatchedEmailProfiles.length > 0) {
		fail(
			[
				`Refusing to continue because UserProfileTable has ${mismatchedEmailProfiles.length} profile record(s) for ${desired.emailNormalized} that do not match Cognito sub ${existingUser?.sub}.`,
				"Mismatched profile IDs:",
				...mismatchedEmailProfiles.map((profile) => `- ${profile.profileId}`),
			].join("\n"),
		);
	}

	const existingTeacherBlocker = getExistingTeacherReconciliationBlocker({
		desiredEmailNormalized: desired.emailNormalized,
		existingUser,
		existingProfile,
	});

	if (existingTeacherBlocker) {
		fail(existingTeacherBlocker);
	}

	const plan = [
		...buildTestTeacherReplacementPlan(replacementTargets),
		...buildPlan({
			desired,
			existingUser,
			existingProfile,
			resetTemporaryPassword: args.resetTemporaryPassword,
			passwordEnv: args.passwordEnv,
			permanentPasswordEnv: args.permanentPasswordEnv,
		}),
	];

	printPlan(plan, args.apply);

	if (!args.apply) {
		console.log(
			"\nDry run only. Re-run with --apply after reviewing the actions above.",
		);
		process.exit(0);
	}

	if (hasTestTeacherReplacementTargets(replacementTargets)) {
		await deleteTestTeacherReplacementTargets(context, replacementTargets);
		state = await loadBootstrapState(context, desired.emailNormalized);
		({
			existingUser,
			duplicateProfilesForEmail,
			existingProfile,
			teacherProfiles,
			teacherUsers,
			mismatchedEmailProfiles,
		} = state);
	}

	const needsTemporaryPassword = !existingUser || args.resetTemporaryPassword;
	const existingFirstLoginChallenge = existingUser
		? isFirstLoginPasswordChangeRequired(existingUser)
		: false;
	const temporaryPassword = needsTemporaryPassword
		? readTemporaryPassword(args.passwordEnv)
		: null;
	const permanentPassword = args.permanentPasswordEnv
		? readPermanentPassword(args.permanentPasswordEnv)
		: null;

	let finalUser = existingUser;

	if (!finalUser) {
		await context.cognito.send(
			new AdminCreateUserCommand({
				UserPoolId: context.userPoolId,
				Username: desired.emailNormalized,
				TemporaryPassword: temporaryPassword!,
				MessageAction: "SUPPRESS",
				UserAttributes: desiredUserAttributes(desired),
			}),
		);

		finalUser = await requireCognitoUser(context, desired.emailNormalized);
		console.log(`Created Cognito teacher user ${desired.emailNormalized}.`);
	}

	if (!finalUser.enabled) {
		await context.cognito.send(
			new AdminEnableUserCommand({
				UserPoolId: context.userPoolId,
				Username: finalUser.username,
			}),
		);
		console.log(`Enabled Cognito user ${finalUser.username}.`);
	}

	if (hasAttributeDrift(finalUser.attributes, desired)) {
		await context.cognito.send(
			new AdminUpdateUserAttributesCommand({
				UserPoolId: context.userPoolId,
				Username: finalUser.username,
				UserAttributes: desiredUserAttributes(desired),
			}),
		);
		console.log(`Reconciled Cognito attributes for ${finalUser.username}.`);
	}

	if (existingUser && args.resetTemporaryPassword && temporaryPassword) {
		await context.cognito.send(
			new AdminSetUserPasswordCommand({
				UserPoolId: context.userPoolId,
				Username: finalUser.username,
				Password: temporaryPassword,
				Permanent: false,
			}),
		);
		console.log(
			`Reset the temporary password for ${finalUser.username}; first login will require a password change.`,
		);
	}

	if (!finalUser.groups.includes(TEACHER_GROUP)) {
		await context.cognito.send(
			new AdminAddUserToGroupCommand({
				UserPoolId: context.userPoolId,
				Username: finalUser.username,
				GroupName: TEACHER_GROUP,
			}),
		);
		console.log(`Added ${finalUser.username} to the ${TEACHER_GROUP} group.`);
	}

	const profileUser = await requireCognitoUser(
		context,
		desired.emailNormalized,
	);
	const nextProfile = buildProfileRecord({
		desired,
		existingProfile,
		cognitoSub: profileUser.sub,
	});

	await context.dynamo.send(
		new PutCommand({
			TableName: context.userProfileTableName,
			Item: nextProfile,
		}),
	);

	if (permanentPassword) {
		await context.cognito.send(
			new AdminSetUserPasswordCommand({
				UserPoolId: context.userPoolId,
				Username: profileUser.username,
				Password: permanentPassword,
				Permanent: true,
			}),
		);
		console.log(
			`Set the permanent password for ${profileUser.username}; Cognito first-login password change is not required.`,
		);
	}

	const refreshedUser = await requireCognitoUser(
		context,
		desired.emailNormalized,
	);

	if (permanentPassword && isFirstLoginPasswordChangeRequired(refreshedUser)) {
		fail(
			`Permanent password was set for ${refreshedUser.username}, but Cognito still reports ${FIRST_LOGIN_PASSWORD_CHANGE_STATUS}.`,
		);
	}

	const passwordEvidence = passwordEvidenceLines({
		needsTemporaryPassword,
		temporaryPasswordEnv: args.passwordEnv,
		permanentPasswordEnv: args.permanentPasswordEnv,
		existingFirstLoginChallenge,
	});
	const signInGuidance = permanentPassword
		? "Teacher should sign in on /login with the permanent password."
		: "Teacher should sign in on /login and complete the Cognito first-login password change before accessing /teacher.";

	console.log(
		[
			"",
			`Upserted teacher profile ${nextProfile.profileId} in ${context.userProfileTableName}.`,
			`Cognito status: ${refreshedUser.status ?? "unknown"}; enabled: ${String(refreshedUser.enabled)}; groups: ${refreshedUser.groups.join(", ") || "(none)"}`,
			...passwordEvidence,
			signInGuidance,
		].join("\n"),
	);
}

async function loadBootstrapState(
	context: BootstrapContext,
	desiredEmailNormalized: string,
): Promise<BootstrapState> {
	const existingUser = await getCognitoUser(context, desiredEmailNormalized);
	const existingProfilesForEmail = await getProfilesByEmail(
		context,
		desiredEmailNormalized,
	);
	const duplicateProfilesForEmail = existingProfilesForEmail.filter(
		(profile) => profile.emailNormalized === desiredEmailNormalized,
	);
	const existingProfile = existingUser?.sub
		? await getProfileById(context, existingUser.sub)
		: null;
	const teacherProfiles = await getTeacherProfiles(context);
	const teacherUsers = await listTeacherUsers(context);
	const mismatchedEmailProfiles = existingUser
		? duplicateProfilesForEmail.filter(
				(profile) => profile.profileId !== existingUser.sub,
			)
		: [];

	return {
		existingUser,
		existingProfilesForEmail,
		duplicateProfilesForEmail,
		existingProfile,
		teacherProfiles,
		teacherUsers,
		mismatchedEmailProfiles,
	};
}

type ParsedTestTeacherMailbox = {
	domain: string;
	localPrefix: string;
};

export function isTestTeacherEmail(email: string, mailbox: string) {
	const parsedMailbox = parseTestTeacherMailbox(mailbox);

	if (!parsedMailbox) {
		return false;
	}

	const [localPart, domain, ...extraParts] = normalizeEmail(email).split("@");
	const prNumber = localPart?.slice(parsedMailbox.localPrefix.length) ?? "";

	return (
		Boolean(localPart) &&
		Boolean(domain) &&
		extraParts.length === 0 &&
		domain === parsedMailbox.domain &&
		localPart.startsWith(parsedMailbox.localPrefix) &&
		/^[0-9]+$/.test(prNumber)
	);
}

export function getTestTeacherReplacementBlocker(args: {
	desiredEmailNormalized: string;
	testTeacherMailbox: string | null;
	testTeacherUsers: CognitoUserState[];
	teacherProfiles: TeacherProfileRecord[];
	teacherUsers: CognitoUserState[];
}) {
	if (!args.testTeacherMailbox || !parseTestTeacherMailbox(args.testTeacherMailbox)) {
		return `Refusing to replace an existing test teacher because ${DEFAULT_TEST_TEACHER_MAILBOX_ENV} is missing or invalid.`;
	}

	if (!isTestTeacherEmail(args.desiredEmailNormalized, args.testTeacherMailbox)) {
		return [
			`Refusing to replace an existing test teacher because ${args.desiredEmailNormalized} is not a generated smoke teacher email.`,
			`Only teacher emails derived from ${DEFAULT_TEST_TEACHER_MAILBOX_ENV} can use --replace-existing-test-teacher.`,
		].join("\n");
	}

	const nonTestTeacherEvidence = [
		...args.teacherProfiles
			.filter(
				(profile) =>
					!isReplaceableTestTeacherProfile(profile, args.testTeacherMailbox!),
			)
			.map(formatTeacherProfileEvidence),
		...args.teacherUsers
			.filter(
				(user) => !isReplaceableTestTeacherUser(user, args.testTeacherMailbox!),
			)
			.map(formatTeacherUserEvidence),
	];
	const testTeacherStudentEvidence = args.testTeacherUsers
		.filter(
			(user) =>
				user.groups.includes(STUDENT_GROUP) &&
				isTestTeacherEmail(getUserEmailNormalized(user), args.testTeacherMailbox!),
		)
		.map(formatTeacherUserEvidence);

	if (nonTestTeacherEvidence.length > 0) {
		return [
			"Refusing to replace an existing test teacher because this stage has a non-test teacher identity.",
			"Non-test teacher identity evidence:",
			...nonTestTeacherEvidence,
			"Delete only generated smoke teacher accounts with this bootstrap option; remediate real teacher identities manually.",
		].join("\n");
	}

	if (testTeacherStudentEvidence.length > 0) {
		return [
			"Refusing to replace an existing test teacher because a generated smoke teacher Cognito user is also in the student group.",
			"Unexpected Cognito group evidence:",
			...testTeacherStudentEvidence,
			"Remove the student group membership manually before using this bootstrap option.",
		].join("\n");
	}

	return null;
}

export function getTestTeacherReplacementTargets(args: {
	existingUser: CognitoUserState | null;
	testTeacherMailbox: string | null;
	testTeacherUsers: CognitoUserState[];
	teacherProfiles: TeacherProfileRecord[];
	teacherUsers: CognitoUserState[];
}): TestTeacherReplacementTargets {
	if (!args.testTeacherMailbox || !parseTestTeacherMailbox(args.testTeacherMailbox)) {
		return emptyTestTeacherReplacementTargets();
	}

	const cognitoUsers = uniqueCognitoUsers([
		...args.testTeacherUsers.filter((user) =>
			isReplaceableTestTeacherCognitoUser(user, args.testTeacherMailbox!),
		),
		...args.teacherUsers.filter((user) =>
			isReplaceableTestTeacherUser(user, args.testTeacherMailbox!),
		),
		...(args.existingUser &&
		isReplaceableTestTeacherCognitoUser(
			args.existingUser,
			args.testTeacherMailbox,
		)
			? [args.existingUser]
			: []),
	]);
	const profiles = uniqueTeacherProfiles(
		args.teacherProfiles.filter((profile) =>
			isReplaceableTestTeacherProfile(profile, args.testTeacherMailbox!),
		),
	);

	return { cognitoUsers, profiles };
}

function emptyTestTeacherReplacementTargets(): TestTeacherReplacementTargets {
	return { cognitoUsers: [], profiles: [] };
}

function hasTestTeacherReplacementTargets(
	targets: TestTeacherReplacementTargets,
) {
	return targets.cognitoUsers.length > 0 || targets.profiles.length > 0;
}

function buildTestTeacherReplacementPlan(
	targets: TestTeacherReplacementTargets,
) {
	const actions: string[] = [];

	for (const user of targets.cognitoUsers) {
		actions.push(
			`Delete existing test teacher Cognito user ${user.username} (${getUserEmailNormalized(user)}).`,
		);
	}

	for (const profile of targets.profiles) {
		actions.push(
			`Delete existing test teacher UserProfileTable record ${profile.profileId} (${profile.emailNormalized}).`,
		);
	}

	return actions;
}

function removeTestTeacherReplacementTargets(
	state: BootstrapState,
	targets: TestTeacherReplacementTargets,
): BootstrapState {
	const deletedUserKeys = new Set(
		targets.cognitoUsers.flatMap((user) => [user.username, user.sub]),
	);
	const deletedProfileIds = new Set(
		targets.profiles.map((profile) => profile.profileId),
	);
	const existingUser =
		state.existingUser &&
		(deletedUserKeys.has(state.existingUser.username) ||
			deletedUserKeys.has(state.existingUser.sub))
			? null
			: state.existingUser;
	const existingProfilesForEmail = state.existingProfilesForEmail.filter(
		(profile) => !deletedProfileIds.has(profile.profileId),
	);
	const existingProfile =
		state.existingProfile &&
		deletedProfileIds.has(state.existingProfile.profileId)
			? null
			: state.existingProfile;
	const teacherProfiles = state.teacherProfiles.filter(
		(profile) => !deletedProfileIds.has(profile.profileId),
	);
	const teacherUsers = state.teacherUsers.filter(
		(user) =>
			!deletedUserKeys.has(user.username) && !deletedUserKeys.has(user.sub),
	);
	const duplicateProfilesForEmail = existingProfilesForEmail;
	const mismatchedEmailProfiles = existingUser
		? duplicateProfilesForEmail.filter(
				(profile) => profile.profileId !== existingUser.sub,
			)
		: [];

	return {
		existingUser,
		existingProfilesForEmail,
		duplicateProfilesForEmail,
		existingProfile,
		teacherProfiles,
		teacherUsers,
		mismatchedEmailProfiles,
	};
}

async function deleteTestTeacherReplacementTargets(
	context: BootstrapContext,
	targets: TestTeacherReplacementTargets,
) {
	for (const user of targets.cognitoUsers) {
		await deleteCognitoUser(context, user);
	}

	for (const profile of targets.profiles) {
		await context.dynamo.send(
			new DeleteCommand({
				TableName: context.userProfileTableName,
				Key: { profileId: profile.profileId },
			}),
		);
		console.log(
			`Deleted existing test teacher UserProfileTable record ${profile.profileId}.`,
		);
	}
}

async function deleteCognitoUser(
	context: BootstrapContext,
	user: CognitoUserState,
) {
	try {
		await context.cognito.send(
			new AdminDeleteUserCommand({
				UserPoolId: context.userPoolId,
				Username: user.username,
			}),
		);
		console.log(`Deleted existing test teacher Cognito user ${user.username}.`);
	} catch (error) {
		if (errorName(error) !== "UserNotFoundException") {
			throw error;
		}

		console.log(
			`Cognito user ${user.username} was already gone; skipping deletion.`,
		);
	}
}

function isReplaceableTestTeacherProfile(
	profile: TeacherProfileRecord,
	mailbox: string,
) {
	return (
		profile.role === TEACHER_GROUP &&
		isTestTeacherEmail(profile.emailNormalized, mailbox)
	);
}

function isReplaceableTestTeacherUser(user: CognitoUserState, mailbox: string) {
	return (
		user.groups.includes(TEACHER_GROUP) &&
		isReplaceableTestTeacherCognitoUser(user, mailbox)
	);
}

function isReplaceableTestTeacherCognitoUser(
	user: CognitoUserState,
	mailbox: string,
) {
	return (
		!user.groups.includes(STUDENT_GROUP) &&
		isTestTeacherEmail(getUserEmailNormalized(user), mailbox)
	);
}

function uniqueCognitoUsers(users: CognitoUserState[]) {
	const seen = new Set<string>();
	const uniqueUsers: CognitoUserState[] = [];

	for (const user of users) {
		const key = user.sub || user.username;

		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		uniqueUsers.push(user);
	}

	return uniqueUsers;
}

function uniqueTeacherProfiles(profiles: TeacherProfileRecord[]) {
	const seen = new Set<string>();
	const uniqueProfiles: TeacherProfileRecord[] = [];

	for (const profile of profiles) {
		if (seen.has(profile.profileId)) {
			continue;
		}

		seen.add(profile.profileId);
		uniqueProfiles.push(profile);
	}

	return uniqueProfiles;
}

export function getSingleTeacherIdentityBlocker(args: {
	desiredEmailNormalized: string;
	existingUser: CognitoUserState | null;
	teacherProfiles: TeacherProfileRecord[];
	teacherUsers: CognitoUserState[];
}) {
	const desiredEmailNormalized = normalizeEmail(args.desiredEmailNormalized);
	const conflictingProfiles = args.teacherProfiles.filter(
		(profile) =>
			normalizeEmail(profile.emailNormalized) !== desiredEmailNormalized,
	);
	const conflictingUsers = args.teacherUsers.filter(
		(user) => getUserEmailNormalized(user) !== desiredEmailNormalized,
	);

	if (conflictingProfiles.length > 0 || conflictingUsers.length > 0) {
		return [
			`Refusing to bootstrap ${desiredEmailNormalized} because v1 supports exactly one teacher account/persona and another teacher identity already exists.`,
			"Existing teacher identity evidence:",
			...conflictingProfiles.map(formatTeacherProfileEvidence),
			...conflictingUsers.map(formatTeacherUserEvidence),
			"Use the cleanup script or manual remediation before bootstrapping a different teacher email.",
		].join("\n");
	}

	if (args.teacherProfiles.length > 1) {
		return [
			`Refusing to bootstrap ${desiredEmailNormalized} because UserProfileTable has ${args.teacherProfiles.length} teacher profile records for the same teacher email.`,
			"Teacher profile IDs:",
			...args.teacherProfiles.map((profile) => `- ${profile.profileId}`),
			"Resolve the duplicate teacher profiles before running bootstrap again.",
		].join("\n");
	}

	if (args.teacherUsers.length > 1) {
		return [
			`Refusing to bootstrap ${desiredEmailNormalized} because Cognito has ${args.teacherUsers.length} users in the teacher group for the same teacher email.`,
			"Cognito teacher users:",
			...args.teacherUsers.map(formatTeacherUserEvidence),
			"Resolve the duplicate teacher group membership before running bootstrap again.",
		].join("\n");
	}

	if (!args.existingUser && args.teacherUsers.length > 0) {
		return [
			`Refusing to create Cognito user ${desiredEmailNormalized} because the ${TEACHER_GROUP} group already contains that teacher email, but direct user lookup by email did not resolve it.`,
			...args.teacherUsers.map(formatTeacherUserEvidence),
			"Resolve the Cognito identity mismatch before running bootstrap again.",
		].join("\n");
	}

	if (args.existingUser) {
		const mismatchedTeacherUsers = args.teacherUsers.filter(
			(user) => user.sub !== args.existingUser?.sub,
		);

		if (mismatchedTeacherUsers.length > 0) {
			return [
				`Refusing to bootstrap ${desiredEmailNormalized} because the ${TEACHER_GROUP} group points at a different Cognito sub than direct lookup returned.`,
				`Direct lookup sub: ${args.existingUser.sub}`,
				"Teacher group users:",
				...mismatchedTeacherUsers.map(formatTeacherUserEvidence),
				"Resolve the Cognito identity mismatch before running bootstrap again.",
			].join("\n");
		}
	}

	return null;
}

export function getExistingTeacherReconciliationBlocker(args: {
	desiredEmailNormalized: string;
	existingUser: CognitoUserState | null;
	existingProfile: TeacherProfileRecord | null;
}) {
	if (!args.existingUser) {
		return null;
	}

	const hasTeacherGroup = args.existingUser.groups.includes(TEACHER_GROUP);
	const hasTeacherProfile = args.existingProfile?.role === TEACHER_GROUP;

	if (hasTeacherGroup && hasTeacherProfile) {
		return null;
	}

	const missingEvidence: string[] = [];

	if (!hasTeacherGroup) {
		missingEvidence.push(
			`- Cognito user is not in the ${TEACHER_GROUP} group.`,
		);
	}

	if (!args.existingProfile) {
		missingEvidence.push(
			`- UserProfileTable has no teacher profile for Cognito sub ${args.existingUser.sub}.`,
		);
	} else if (args.existingProfile.role !== TEACHER_GROUP) {
		missingEvidence.push(
			`- UserProfileTable profile ${args.existingProfile.profileId} has role ${args.existingProfile.role}.`,
		);
	}

	return [
		`Refusing to bootstrap ${args.desiredEmailNormalized} because it belongs to existing Cognito user ${args.existingUser.username}, but that user is not already a complete teacher identity.`,
		"Teacher bootstrap only creates a brand-new teacher account or reconciles an existing teacher account.",
		...missingEvidence,
		"Use a new teacher email, or remediate the existing identity manually outside this script.",
	].join("\n");
}

export function isFirstLoginPasswordChangeRequired(user: CognitoUserState) {
	return user.status === FIRST_LOGIN_PASSWORD_CHANGE_STATUS;
}

function buildPlan(args: {
	desired: DesiredTeacherState;
	existingUser: CognitoUserState | null;
	existingProfile: TeacherProfileRecord | null;
	resetTemporaryPassword: boolean;
	passwordEnv: string;
	permanentPasswordEnv: string | null;
}) {
	const { desired, existingUser, existingProfile } = args;
	const actions: string[] = [];

	if (!existingUser) {
		actions.push(
			`Create Cognito user ${desired.emailNormalized} with email_verified=true and the teacher name attributes.`,
		);
		actions.push(
			`Require a Cognito-compliant temporary password from $${args.passwordEnv}; Cognito will force a password change on first login.`,
		);
	} else {
		actions.push(
			`Reuse existing Cognito user ${existingUser.username} (status: ${existingUser.status ?? "unknown"}, enabled: ${String(existingUser.enabled)}).`,
		);

		if (hasAttributeDrift(existingUser.attributes, desired)) {
			actions.push(
				"Reconcile Cognito email/name attributes to the requested teacher values.",
			);
		} else {
			actions.push(
				"Cognito email/name attributes already match the requested teacher values.",
			);
		}

		if (!existingUser.enabled) {
			actions.push("Enable the Cognito user.");
		}

		if (args.resetTemporaryPassword) {
			actions.push(
				`Reset a Cognito-compliant temporary password from $${args.passwordEnv} and put the user back into Cognito's first-login password-change flow.`,
			);
		} else if (
			isFirstLoginPasswordChangeRequired(existingUser) &&
			!args.permanentPasswordEnv
		) {
			actions.push("Leave the existing temporary password challenge in place.");
		} else if (!args.permanentPasswordEnv) {
			actions.push("Leave the existing password unchanged.");
		}
	}

	if (args.permanentPasswordEnv) {
		actions.push(
			`Set a Cognito-compliant permanent password from $${args.permanentPasswordEnv} so the teacher can sign in without the first-login password-change flow.`,
		);
	}

	if (!existingUser?.groups.includes(TEACHER_GROUP)) {
		actions.push(`Add the user to the ${TEACHER_GROUP} Cognito group.`);
	} else {
		actions.push(`User is already in the ${TEACHER_GROUP} Cognito group.`);
	}

	if (!existingProfile) {
		actions.push(
			"Create the DynamoDB teacher profile record after resolving the Cognito sub.",
		);
	} else if (hasProfileDrift(existingProfile, desired)) {
		actions.push(
			`Update the DynamoDB teacher profile ${existingProfile.profileId} so role/email/name fields match Cognito.`,
		);
	} else {
		actions.push(
			`DynamoDB teacher profile ${existingProfile.profileId} already matches the requested teacher values.`,
		);
	}

	return actions;
}

function printPlan(actions: string[], apply: boolean) {
	console.log(`${apply ? "Apply" : "Dry run"} plan:`);

	for (const [index, action] of actions.entries()) {
		console.log(`${index + 1}. ${action}`);
	}
}

function passwordEvidenceLines(args: {
	needsTemporaryPassword: boolean;
	temporaryPasswordEnv: string;
	permanentPasswordEnv: string | null;
	existingFirstLoginChallenge: boolean;
}) {
	const lines: string[] = [];

	if (args.needsTemporaryPassword) {
		lines.push(
			`Temporary password was read from ${args.temporaryPasswordEnv} and was not echoed. Clear that environment variable from your shell now.`,
		);
	}

	if (args.permanentPasswordEnv) {
		lines.push(
			`Permanent password was read from ${args.permanentPasswordEnv} and was not echoed. Clear that environment variable from your shell now.`,
		);
	}

	if (lines.length > 0) {
		return lines;
	}

	return [
		args.existingFirstLoginChallenge
			? "Existing Cognito first-login password-change challenge was left in place."
			: "Existing password was left unchanged.",
	];
}

function buildProfileRecord(args: {
	desired: DesiredTeacherState;
	existingProfile: TeacherProfileRecord | null;
	cognitoSub: string;
}): TeacherProfileRecord {
	const now = Math.floor(Date.now() / 1000);

	return {
		...args.existingProfile,
		profileId: args.cognitoSub,
		emailNormalized: args.desired.emailNormalized,
		firstName: args.desired.firstName,
		lastName: args.desired.lastName,
		fullName: args.desired.fullName,
		role: "teacher",
		emailVerifiedAt: args.existingProfile?.emailVerifiedAt ?? now,
		createdAt: args.existingProfile?.createdAt ?? now,
		updatedAt: now,
	};
}

function desiredUserAttributes(
	desiredState: DesiredTeacherState,
): AttributeType[] {
	return [
		{ Name: "email", Value: desiredState.emailNormalized },
		{ Name: "email_verified", Value: "true" },
		{ Name: "given_name", Value: desiredState.firstName },
		{ Name: "family_name", Value: desiredState.lastName },
		{ Name: "name", Value: desiredState.fullName },
	];
}

function hasAttributeDrift(
	attributes: Record<string, string>,
	desiredState: DesiredTeacherState,
) {
	return (
		attributes.email !== desiredState.emailNormalized ||
		attributes.email_verified !== "true" ||
		attributes.given_name !== desiredState.firstName ||
		attributes.family_name !== desiredState.lastName ||
		attributes.name !== desiredState.fullName
	);
}

function hasProfileDrift(
	profile: TeacherProfileRecord,
	desiredState: DesiredTeacherState,
) {
	return (
		profile.role !== "teacher" ||
		profile.emailNormalized !== desiredState.emailNormalized ||
		profile.firstName !== desiredState.firstName ||
		profile.lastName !== desiredState.lastName ||
		profile.fullName !== desiredState.fullName
	);
}

function createBootstrapContext(): BootstrapContext {
	const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
	const clientConfig = region ? { region } : {};
	const resources = Resource as unknown as BootstrapResources;

	return {
		userPoolId: resources.AuthUserPool.id,
		userProfileTableName: resources.UserProfileTable.name,
		cognito: new CognitoIdentityProviderClient(clientConfig),
		dynamo: DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig)),
	};
}

async function getCognitoUser(
	context: BootstrapContext,
	emailNormalized: string,
): Promise<CognitoUserState | null> {
	try {
		const response = await context.cognito.send(
			new AdminGetUserCommand({
				UserPoolId: context.userPoolId,
				Username: emailNormalized,
			}),
		);
		const groups = await listUserGroups(
			context,
			response.Username ??
				response.UserAttributes?.find((attribute) => attribute.Name === "email")
					?.Value ??
				emailNormalized,
		);

		return mapCognitoUser(response, groups);
	} catch (error) {
		if (errorName(error) === "UserNotFoundException") {
			return null;
		}

		throw error;
	}
}

async function requireCognitoUser(
	context: BootstrapContext,
	emailNormalized: string,
) {
	const user = await getCognitoUser(context, emailNormalized);

	if (!user) {
		throw new Error(`Expected Cognito user ${emailNormalized} to exist.`);
	}

	return user;
}

function mapCognitoUser(user: AdminGetUserCommandOutput, groups: string[]) {
	const attributes = listToRecord(user.UserAttributes ?? []);
	const sub = attributes.sub;

	if (!sub) {
		throw new Error("Cognito user is missing the required sub attribute.");
	}

	return {
		username: user.Username ?? attributes.email ?? "",
		sub,
		enabled: user.Enabled ?? true,
		status: user.UserStatus,
		attributes,
		groups,
	};
}

function mapCognitoGroupUser(user: UserType): CognitoUserState {
	return mapCognitoListUser(user, [TEACHER_GROUP]);
}

function mapCognitoListUser(user: UserType, groups: string[]): CognitoUserState {
	const attributes = listToRecord(user.Attributes ?? []);
	const sub = attributes.sub;

	if (!sub) {
		throw new Error(
			"Cognito user is missing the required sub attribute.",
		);
	}

	return {
		username: user.Username ?? attributes.email ?? "",
		sub,
		enabled: user.Enabled ?? true,
		status: user.UserStatus,
		attributes,
		groups,
	};
}

async function getProfileById(context: BootstrapContext, profileId: string) {
	const response = await context.dynamo.send(
		new GetCommand({
			TableName: context.userProfileTableName,
			Key: { profileId },
			ConsistentRead: true,
		}),
	);

	return (response.Item as TeacherProfileRecord | undefined) ?? null;
}

async function getProfilesByEmail(
	context: BootstrapContext,
	emailNormalized: string,
) {
	const response = await context.dynamo.send(
		new QueryCommand({
			TableName: context.userProfileTableName,
			IndexName: "EmailIndex",
			KeyConditionExpression: "emailNormalized = :email",
			ExpressionAttributeValues: {
				":email": emailNormalized,
			},
		}),
	);

	return (response.Items ?? []) as TeacherProfileRecord[];
}

async function getTeacherProfiles(context: BootstrapContext) {
	const profiles: TeacherProfileRecord[] = [];

	for await (const page of paginateQuery(
		{ client: context.dynamo },
		{
			TableName: context.userProfileTableName,
			IndexName: "RoleIndex",
			KeyConditionExpression: "#role = :role",
			ExpressionAttributeNames: {
				"#role": "role",
			},
			ExpressionAttributeValues: {
				":role": TEACHER_GROUP,
			},
		},
	)) {
		profiles.push(...((page.Items ?? []) as TeacherProfileRecord[]));
	}

	return profiles;
}

async function listUserGroups(context: BootstrapContext, username: string) {
	const response = await context.cognito.send(
		new AdminListGroupsForUserCommand({
			UserPoolId: context.userPoolId,
			Username: username,
		}),
	);

	return (
		response.Groups?.map((group) => group.GroupName ?? "").filter(Boolean) ?? []
	);
}

async function listTeacherUsers(context: BootstrapContext) {
	const users: CognitoUserState[] = [];

	for await (const page of paginateListUsersInGroup(
		{ client: context.cognito },
		{
			UserPoolId: context.userPoolId,
			GroupName: TEACHER_GROUP,
		},
	)) {
		users.push(...(page.Users ?? []).map(mapCognitoGroupUser));
	}

	return users;
}

async function listTestTeacherUsers(context: BootstrapContext, mailbox: string) {
	const users: CognitoUserState[] = [];

	for await (const page of paginateListUsers(
		{ client: context.cognito },
		{
			UserPoolId: context.userPoolId,
		},
	)) {
		for (const user of page.Users ?? []) {
			const attributes = listToRecord(user.Attributes ?? []);
			const emailNormalized = normalizeEmail(
				attributes.email ?? user.Username ?? "",
			);

			if (!isTestTeacherEmail(emailNormalized, mailbox)) {
				continue;
			}

			const username = user.Username ?? emailNormalized;
			const groups = await listUserGroups(context, username);
			users.push(mapCognitoListUser(user, groups));
		}
	}

	return users;
}

function listToRecord(attributes: AttributeType[]) {
	return Object.fromEntries(
		attributes
			.filter((attribute) => attribute.Name && attribute.Value)
			.map((attribute) => [attribute.Name!, attribute.Value!]),
	);
}

function getUserEmailNormalized(user: CognitoUserState) {
	return normalizeEmail(user.attributes.email ?? user.username);
}

function formatTeacherProfileEvidence(profile: TeacherProfileRecord) {
	return `- DynamoDB teacher profile ${profile.profileId}: ${profile.emailNormalized || "(missing email)"}`;
}

function formatTeacherUserEvidence(user: CognitoUserState) {
	return `- Cognito teacher group user ${user.username}: ${getUserEmailNormalized(user) || "(missing email)"} (sub: ${user.sub})`;
}

function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

function readTestTeacherMailbox(envName: string) {
	const value = process.env[envName];

	if (!value) {
		fail(
			`Missing smoke test mailbox. Export ${envName} before running with --replace-existing-test-teacher.`,
		);
	}

	const mailbox = normalizeEmail(value.replace(/^mailto:/i, ""));

	if (!parseTestTeacherMailbox(mailbox)) {
		fail(
			`${envName} must be a single smoke test mailbox email address, for example smoke-tests@eccs-online.com.`,
		);
	}

	return mailbox;
}

function parseTestTeacherMailbox(
	mailbox: string,
): ParsedTestTeacherMailbox | null {
	const normalized = normalizeEmail(mailbox.replace(/^mailto:/i, ""));

	if (!/^[^\s@,\x00-\x1F\x7F]+@[^\s@,/\x00-\x1F\x7F]+$/.test(normalized)) {
		return null;
	}

	const atIndex = normalized.indexOf("@");
	const localPart = normalized.slice(0, atIndex);
	const domain = normalized.slice(atIndex + 1);
	const separator = localPart.includes("+") ? "-" : "+";

	return {
		domain,
		localPrefix: `${localPart}${separator}teacher-production-pr-`,
	};
}

function readTemporaryPassword(envName: string) {
	return readPassword(envName, "temporary");
}

function readPermanentPassword(envName: string) {
	return readPassword(envName, "permanent");
}

function readPassword(envName: string, label: "temporary" | "permanent") {
	const value = process.env[envName];

	if (!value) {
		fail(
			`Missing ${label} password. Export ${envName} in your shell before running with --apply.`,
		);
	}

	const validationError = getTeacherPasswordValidationError(value, envName);

	if (validationError) {
		fail(validationError);
	}

	return value;
}

export function getTemporaryPasswordValidationError(
	value: string,
	envName = DEFAULT_PASSWORD_ENV,
) {
	return getTeacherPasswordValidationError(value, envName);
}

export function getPermanentPasswordValidationError(
	value: string,
	envName = DEFAULT_PERMANENT_PASSWORD_ENV,
) {
	return getTeacherPasswordValidationError(value, envName);
}

export function getTeacherPasswordValidationError(value: string, envName: string) {
	const missingRequirements = failedPasswordRequirements(value);

	if (missingRequirements.length > 0) {
		return `${envName} must satisfy the Cognito password policy used in this repo: ${passwordRequirementMessage(missingRequirements)}`;
	}

	return null;
}

function validateRequired(label: string, value: string) {
	if (!value) {
		fail(`Missing required --${label} value.`);
	}
}

function parseArgs(argv: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		email: "",
		firstName: "",
		lastName: "",
		apply: false,
		replaceExistingTestTeacher: false,
		resetTemporaryPassword: false,
		passwordEnv: DEFAULT_PASSWORD_ENV,
		permanentPasswordEnv: null,
		testTeacherMailboxEnv: DEFAULT_TEST_TEACHER_MAILBOX_ENV,
		help: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		switch (arg) {
			case "--email":
				parsed.email = argv[++index] ?? "";
				break;
			case "--first-name":
				parsed.firstName = argv[++index] ?? "";
				break;
			case "--last-name":
				parsed.lastName = argv[++index] ?? "";
				break;
			case "--apply":
				parsed.apply = true;
				break;
			case "--replace-existing-test-teacher":
				parsed.replaceExistingTestTeacher = true;
				break;
			case "--reset-temporary-password":
				parsed.resetTemporaryPassword = true;
				break;
			case "--set-permanent-password":
				parsed.permanentPasswordEnv ??= DEFAULT_PERMANENT_PASSWORD_ENV;
				break;
			case "--permanent-password-env":
				parsed.permanentPasswordEnv = readRequiredOptionValue(
					argv,
					++index,
					"--permanent-password-env",
				);
				break;
			case "--password-env":
				parsed.passwordEnv = argv[++index] ?? DEFAULT_PASSWORD_ENV;
				break;
			case "--test-teacher-mailbox-env":
				parsed.testTeacherMailboxEnv = readRequiredOptionValue(
					argv,
					++index,
					"--test-teacher-mailbox-env",
				);
				break;
			case "--help":
			case "-h":
				parsed.help = true;
				break;
			default:
				fail(`Unknown argument: ${arg}`);
		}
	}

	return parsed;
}

function readRequiredOptionValue(
	argv: string[],
	index: number,
	optionName: string,
) {
	const value = argv[index];

	if (!value || value.startsWith("--")) {
		fail(`Missing required value for ${optionName}.`);
	}

	return value;
}

function printHelp() {
	console.log(`One-time teacher bootstrap script

Usage:
  bunx sst shell --stage ailocal -- bun scripts/bootstrap-teacher.ts \\
    --email teacher@example.com \\
    --first-name Taylor \\
    --last-name Smith

Options:
  --apply                     Execute Cognito and DynamoDB writes. Without this flag the script is a dry run.
  --replace-existing-test-teacher
                              Delete existing generated smoke teacher identities before bootstrapping this teacher. Only works for teacher-production-pr-<number> emails.
  --reset-temporary-password  For an existing teacher user, set a fresh temporary password and require first-login password change again.
  --password-env NAME         Environment variable that holds the temporary password. Default: ${DEFAULT_PASSWORD_ENV}
  --set-permanent-password    Set a permanent password after the teacher profile is ready. Reads ${DEFAULT_PERMANENT_PASSWORD_ENV} unless --permanent-password-env is provided.
  --permanent-password-env NAME
                              Environment variable that holds the permanent teacher password. Implies --set-permanent-password.
  --test-teacher-mailbox-env NAME
                              Environment variable that holds the controlled smoke test mailbox. Used only with --replace-existing-test-teacher. Default: ${DEFAULT_TEST_TEACHER_MAILBOX_ENV}
  --help, -h                  Show this help text.

Temporary password pre-check:
  The bootstrap script validates both temporary and permanent passwords against the Cognito password policy configured in this repo.
`);
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function errorName(error: unknown) {
	return error instanceof Error ? error.name : undefined;
}

function isMainModule() {
	return process.argv[1]
		? fileURLToPath(import.meta.url) === resolve(process.argv[1])
		: false;
}

if (isMainModule()) {
	await main();
}
