import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminEnableUserCommand,
	AdminGetUserCommand,
	AdminListGroupsForUserCommand,
	AdminSetUserPasswordCommand,
	AdminUpdateUserAttributesCommand,
	CognitoIdentityProviderClient,
	paginateListUsersInGroup,
	type AdminGetUserCommandOutput,
	type AttributeType,
	type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	paginateQuery,
	PutCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

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
	resetTemporaryPassword: boolean;
	passwordEnv: string;
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

const TEACHER_GROUP = "teacher";
const STUDENT_GROUP = "student";
const DEFAULT_PASSWORD_ENV = "TEACHER_TEMP_PASSWORD";
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

	const existingUser = await getCognitoUser(context, desired.emailNormalized);
	const existingProfilesForEmail = await getProfilesByEmail(
		context,
		desired.emailNormalized,
	);
	const duplicateProfilesForEmail = existingProfilesForEmail.filter(
		(profile) => profile.emailNormalized === desired.emailNormalized,
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

	const plan = buildPlan({
		desired,
		existingUser,
		existingProfile,
		resetTemporaryPassword: args.resetTemporaryPassword,
		passwordEnv: args.passwordEnv,
	});

	printPlan(plan, args.apply);

	if (!args.apply) {
		console.log(
			"\nDry run only. Re-run with --apply after reviewing the actions above.",
		);
		process.exit(0);
	}

	const needsTemporaryPassword = !existingUser || args.resetTemporaryPassword;
	const existingFirstLoginChallenge = existingUser
		? isFirstLoginPasswordChangeRequired(existingUser)
		: false;
	const temporaryPassword = needsTemporaryPassword
		? readTemporaryPassword(args.passwordEnv)
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

	if (args.resetTemporaryPassword && temporaryPassword) {
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

	const refreshedUser = await requireCognitoUser(
		context,
		desired.emailNormalized,
	);
	const nextProfile = buildProfileRecord({
		desired,
		existingProfile,
		cognitoSub: refreshedUser.sub,
	});

	await context.dynamo.send(
		new PutCommand({
			TableName: context.userProfileTableName,
			Item: nextProfile,
		}),
	);

	console.log(
		[
			"",
			`Upserted teacher profile ${nextProfile.profileId} in ${context.userProfileTableName}.`,
			`Cognito status: ${refreshedUser.status ?? "unknown"}; enabled: ${String(refreshedUser.enabled)}; groups: ${refreshedUser.groups.join(", ") || "(none)"}`,
			needsTemporaryPassword
				? `Temporary password was read from ${args.passwordEnv} and was not echoed. Clear that environment variable from your shell now.`
				: existingFirstLoginChallenge
					? "Existing Cognito first-login password-change challenge was left in place."
					: "Existing password was left unchanged.",
			"Teacher should sign in on /login and complete the Cognito first-login password change before accessing /teacher.",
		].join("\n"),
	);
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
}) {
	const { desired, existingUser, existingProfile } = args;
	const actions: string[] = [];

	if (!existingUser) {
		actions.push(
			`Create Cognito user ${desired.emailNormalized} with email_verified=true and the teacher name attributes.`,
		);
		actions.push(
			`Require a temporary password from $${args.passwordEnv}; Cognito will force a password change on first login.`,
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
				`Reset a temporary password from $${args.passwordEnv} and put the user back into Cognito's first-login password-change flow.`,
			);
		} else if (isFirstLoginPasswordChangeRequired(existingUser)) {
			actions.push("Leave the existing temporary password challenge in place.");
		} else {
			actions.push("Leave the existing password unchanged.");
		}
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
	const attributes = listToRecord(user.Attributes ?? []);
	const sub = attributes.sub;

	if (!sub) {
		throw new Error(
			"Cognito teacher group user is missing the required sub attribute.",
		);
	}

	return {
		username: user.Username ?? attributes.email ?? "",
		sub,
		enabled: user.Enabled ?? true,
		status: user.UserStatus,
		attributes,
		groups: [TEACHER_GROUP],
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

function readTemporaryPassword(envName: string) {
	const value = process.env[envName];

	if (!value) {
		fail(
			`Missing temporary password. Export ${envName} in your shell before running with --apply.`,
		);
	}

	if (value.length < 8 || !/\d/.test(value)) {
		fail(
			`${envName} must satisfy the Cognito password policy used in this repo: at least 8 characters and at least one number.`,
		);
	}

	return value;
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
		resetTemporaryPassword: false,
		passwordEnv: DEFAULT_PASSWORD_ENV,
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
			case "--reset-temporary-password":
				parsed.resetTemporaryPassword = true;
				break;
			case "--password-env":
				parsed.passwordEnv = argv[++index] ?? DEFAULT_PASSWORD_ENV;
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

function printHelp() {
	console.log(`One-time teacher bootstrap script

Usage:
  bunx sst shell --stage ailocal -- bun scripts/bootstrap-teacher.ts \\
    --email teacher@example.com \\
    --first-name Taylor \\
    --last-name Smith

Options:
  --apply                     Execute Cognito and DynamoDB writes. Without this flag the script is a dry run.
  --reset-temporary-password  For an existing teacher user, set a fresh temporary password and require first-login password change again.
  --password-env NAME         Environment variable that holds the temporary password. Default: ${DEFAULT_PASSWORD_ENV}
  --help, -h                  Show this help text.
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
