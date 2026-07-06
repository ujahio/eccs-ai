import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminEnableUserCommand,
	AdminGetUserCommand,
	AdminListGroupsForUserCommand,
	AdminSetUserPasswordCommand,
	AdminUpdateUserAttributesCommand,
	CognitoIdentityProviderClient,
	type AdminGetUserCommandOutput,
	type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

type BootstrapResources = {
	AuthUserPool: { id: string };
	UserProfileTable: { name: string };
};

type TeacherProfileRecord = {
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

type CognitoUserState = {
	username: string;
	sub: string;
	enabled: boolean;
	status?: string;
	attributes: Record<string, string>;
	groups: string[];
};

const TEACHER_GROUP = "teacher";
const STUDENT_GROUP = "student";
const DEFAULT_PASSWORD_ENV = "TEACHER_TEMP_PASSWORD";

const args = parseArgs(process.argv.slice(2));

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

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const clientConfig = region ? { region } : {};
const resources = Resource as unknown as BootstrapResources;
const userPoolId = resources.AuthUserPool.id;
const userProfileTableName = resources.UserProfileTable.name;
const cognito = new CognitoIdentityProviderClient(clientConfig);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

const existingUser = await getCognitoUser(desired.emailNormalized);
const existingProfilesForEmail = await getProfilesByEmail(desired.emailNormalized);
const duplicateProfilesForEmail = existingProfilesForEmail.filter(
	(profile) => profile.emailNormalized === desired.emailNormalized,
);

if (!existingUser && duplicateProfilesForEmail.length > 0) {
	fail(
		`Refusing to create Cognito user because UserProfileTable already has ${duplicateProfilesForEmail.length} profile record(s) for ${desired.emailNormalized}. Resolve the profile conflict first.`,
	);
}

const existingProfile =
	existingUser?.sub ? await getProfileById(existingUser.sub) : null;
const mismatchedEmailProfiles = existingUser
	? duplicateProfilesForEmail.filter(
			(profile) => profile.profileId !== existingUser.sub,
		)
	: [];

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

const needsTemporaryPassword =
	!existingUser || args.resetTemporaryPassword;
const temporaryPassword = needsTemporaryPassword
	? readTemporaryPassword(args.passwordEnv)
	: null;

let finalUser = existingUser;

if (!finalUser) {
	await cognito.send(
		new AdminCreateUserCommand({
			UserPoolId: userPoolId,
			Username: desired.emailNormalized,
			TemporaryPassword: temporaryPassword!,
			MessageAction: "SUPPRESS",
			UserAttributes: desiredUserAttributes(desired),
		}),
	);

	finalUser = await requireCognitoUser(desired.emailNormalized);
	console.log(`Created Cognito teacher user ${desired.emailNormalized}.`);
}

if (!finalUser.enabled) {
	await cognito.send(
		new AdminEnableUserCommand({
			UserPoolId: userPoolId,
			Username: finalUser.username,
		}),
	);
	console.log(`Enabled Cognito user ${finalUser.username}.`);
}

if (hasAttributeDrift(finalUser.attributes, desired)) {
	await cognito.send(
		new AdminUpdateUserAttributesCommand({
			UserPoolId: userPoolId,
			Username: finalUser.username,
			UserAttributes: desiredUserAttributes(desired),
		}),
	);
	console.log(`Reconciled Cognito attributes for ${finalUser.username}.`);
}

if (args.resetTemporaryPassword && temporaryPassword) {
	await cognito.send(
		new AdminSetUserPasswordCommand({
			UserPoolId: userPoolId,
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
	await cognito.send(
		new AdminAddUserToGroupCommand({
			UserPoolId: userPoolId,
			Username: finalUser.username,
			GroupName: TEACHER_GROUP,
		}),
	);
	console.log(`Added ${finalUser.username} to the ${TEACHER_GROUP} group.`);
}

const refreshedUser = await requireCognitoUser(desired.emailNormalized);
const nextProfile = buildProfileRecord({
	desired,
	existingProfile,
	cognitoSub: refreshedUser.sub,
});

await dynamo.send(
	new PutCommand({
		TableName: userProfileTableName,
		Item: nextProfile,
	}),
);

console.log(
	[
		"",
		`Upserted teacher profile ${nextProfile.profileId} in ${userProfileTableName}.`,
		`Cognito status: ${refreshedUser.status ?? "unknown"}; enabled: ${String(refreshedUser.enabled)}; groups: ${refreshedUser.groups.join(", ") || "(none)"}`,
		needsTemporaryPassword
			? `Temporary password was read from ${args.passwordEnv} and was not echoed. Clear that environment variable from your shell now.`
			: "Existing password was left unchanged.",
		"Teacher should sign in on /login and complete the Cognito first-login password change before accessing /teacher.",
	].join("\n"),
);

function buildPlan(args: {
	desired: typeof desired;
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
			actions.push("Reconcile Cognito email/name attributes to the requested teacher values.");
		} else {
			actions.push("Cognito email/name attributes already match the requested teacher values.");
		}

		if (!existingUser.enabled) {
			actions.push("Enable the Cognito user.");
		}

		if (args.resetTemporaryPassword) {
			actions.push(
				`Reset a temporary password from $${args.passwordEnv} and put the user back into Cognito's first-login password-change flow.`,
			);
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
		actions.push("Create the DynamoDB teacher profile record after resolving the Cognito sub.");
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
	desired: typeof desired;
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

function desiredUserAttributes(desiredState: typeof desired): AttributeType[] {
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
	desiredState: typeof desired,
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
	desiredState: typeof desired,
) {
	return (
		profile.role !== "teacher" ||
		profile.emailNormalized !== desiredState.emailNormalized ||
		profile.firstName !== desiredState.firstName ||
		profile.lastName !== desiredState.lastName ||
		profile.fullName !== desiredState.fullName
	);
}

async function getCognitoUser(
	emailNormalized: string,
): Promise<CognitoUserState | null> {
	try {
		const response = await cognito.send(
			new AdminGetUserCommand({
				UserPoolId: userPoolId,
				Username: emailNormalized,
			}),
		);
		const groups = await listUserGroups(
			response.Username ?? response.UserAttributes?.find((attribute) => attribute.Name === "email")?.Value ?? emailNormalized,
		);

		return mapCognitoUser(response, groups);
	} catch (error) {
		if (errorName(error) === "UserNotFoundException") {
			return null;
		}

		throw error;
	}
}

async function requireCognitoUser(emailNormalized: string) {
	const user = await getCognitoUser(emailNormalized);

	if (!user) {
		throw new Error(`Expected Cognito user ${emailNormalized} to exist.`);
	}

	return user;
}

function mapCognitoUser(
	user: AdminGetUserCommandOutput,
	groups: string[],
) {
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

async function getProfileById(profileId: string) {
	const response = await dynamo.send(
		new GetCommand({
			TableName: userProfileTableName,
			Key: { profileId },
			ConsistentRead: true,
		}),
	);

	return (response.Item as TeacherProfileRecord | undefined) ?? null;
}

async function getProfilesByEmail(emailNormalized: string) {
	const response = await dynamo.send(
		new QueryCommand({
			TableName: userProfileTableName,
			IndexName: "EmailIndex",
			KeyConditionExpression: "emailNormalized = :email",
			ExpressionAttributeValues: {
				":email": emailNormalized,
			},
		}),
	);

	return (response.Items ?? []) as TeacherProfileRecord[];
}

async function listUserGroups(username: string) {
	const response = await cognito.send(
		new AdminListGroupsForUserCommand({
			UserPoolId: userPoolId,
			Username: username,
		}),
	);

	return response.Groups?.map((group) => group.GroupName ?? "").filter(Boolean) ?? [];
}

function listToRecord(attributes: AttributeType[]) {
	return Object.fromEntries(
		attributes
			.filter((attribute) => attribute.Name && attribute.Value)
			.map((attribute) => [attribute.Name!, attribute.Value!]),
	);
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
  bunx sst shell --stage localdev -- bun scripts/bootstrap-teacher.ts \\
    --email teacher@example.com \\
    --first-name Taylor \\
    --last-name Smith

Options:
  --apply                     Execute Cognito and DynamoDB writes. Without this flag the script is a dry run.
  --reset-temporary-password  For an existing Cognito user, set a fresh temporary password and require first-login password change again.
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
