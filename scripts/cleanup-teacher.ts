import {
	AdminDeleteUserCommand,
	AdminGetUserCommand,
	AdminListGroupsForUserCommand,
	CognitoIdentityProviderClient,
	type AdminGetUserCommandOutput,
	type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

type CleanupResources = {
	AuthUserPool: { id: string };
	UserProfileTable: { name: string };
};

type ParsedArgs = {
	email: string;
	apply: boolean;
	help: boolean;
};

type TeacherProfileRecord = {
	profileId: string;
	emailNormalized: string;
	firstName?: string;
	lastName?: string;
	fullName?: string;
	role?: string;
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

const args = parseArgs(process.argv.slice(2));

if (args.help) {
	printHelp();
	process.exit(0);
}

const emailNormalized = normalizeEmail(args.email);
validateRequired("email", emailNormalized);

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const clientConfig = region ? { region } : {};
const resources = Resource as unknown as CleanupResources;
const userPoolId = resources.AuthUserPool.id;
const userProfileTableName = resources.UserProfileTable.name;
const cognito = new CognitoIdentityProviderClient(clientConfig);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

const cognitoUser = await getCognitoUser(emailNormalized);
const profileBySub = cognitoUser ? await getProfileById(cognitoUser.sub) : null;
const profilesByEmail = await getProfilesByEmail(emailNormalized);
const fallbackProfileCandidates = profileBySub
	? profilesByEmail.filter((profile) => profile.profileId !== profileBySub.profileId)
	: profilesByEmail;

if (profileBySub && fallbackProfileCandidates.length > 0) {
	fail(
		[
			`Refusing to continue because UserProfileTable has ${fallbackProfileCandidates.length} additional EmailIndex match(es) for ${emailNormalized} beyond Cognito sub ${profileBySub.profileId}.`,
			"Clean up the duplicate profiles manually before using this rollback script.",
			"Duplicate profile IDs:",
			...fallbackProfileCandidates.map((profile) => `- ${profile.profileId}`),
		].join("\n"),
	);
}

if (!profileBySub && fallbackProfileCandidates.length > 1) {
	fail(
		[
			`Refusing to continue because EmailIndex returned ${fallbackProfileCandidates.length} profile records for ${emailNormalized}.`,
			"Clean up the duplicate profiles manually before using this rollback script.",
			"Duplicate profile IDs:",
			...fallbackProfileCandidates.map((profile) => `- ${profile.profileId}`),
		].join("\n"),
	);
}

if (cognitoUser && !profileBySub && fallbackProfileCandidates.length > 0) {
	fail(
		[
			`Refusing to continue because the Cognito user sub ${cognitoUser.sub} does not match the UserProfileTable EmailIndex result(s) for ${emailNormalized}.`,
			"EmailIndex fallback is only allowed when the Cognito user is already gone.",
			"Mismatched profile IDs:",
			...fallbackProfileCandidates.map((profile) => `- ${profile.profileId}`),
		].join("\n"),
	);
}

const fallbackProfile = fallbackProfileCandidates[0] ?? null;
const targetProfile = profileBySub ?? (cognitoUser ? null : fallbackProfile);
const profileLookupPath = profileBySub
	? "Cognito sub primary key"
	: fallbackProfile
		? "EmailIndex fallback"
		: "none";

if (cognitoUser?.groups.includes(STUDENT_GROUP)) {
	fail(
		`Refusing to delete ${emailNormalized} because the Cognito user is in the ${STUDENT_GROUP} group. This rollback script only removes the bootstrapped teacher account.`,
	);
}

if (targetProfile && targetProfile.role !== TEACHER_GROUP) {
	fail(
		`Refusing to delete UserProfileTable record ${targetProfile.profileId} because its role is ${targetProfile.role ?? "(missing)"}, not ${TEACHER_GROUP}.`,
	);
}

if (cognitoUser && !cognitoUser.groups.includes(TEACHER_GROUP) && !targetProfile) {
	fail(
		`Refusing to delete ${emailNormalized} because no teacher Cognito group or teacher app profile was found for this account.`,
	);
}

printPlan({
	apply: args.apply,
	emailNormalized,
	cognitoUser,
	targetProfile,
	profileLookupPath,
});

if (!args.apply) {
	console.log(
		[
			"",
			"Dry run only. Re-run with --apply to delete the targeted teacher account resources.",
			`The shared ${TEACHER_GROUP} Cognito group is left intact in all modes.`,
		].join("\n"),
	);
	process.exit(0);
}

if (cognitoUser) {
	await cognito.send(
		new AdminDeleteUserCommand({
			UserPoolId: userPoolId,
			Username: cognitoUser.username,
		}),
	);
	console.log(`Deleted Cognito user ${cognitoUser.username}.`);
} else {
	console.log(`No Cognito user found for ${emailNormalized}; skipping Cognito deletion.`);
}

if (targetProfile) {
	await dynamo.send(
		new DeleteCommand({
			TableName: userProfileTableName,
			Key: { profileId: targetProfile.profileId },
		}),
	);
	console.log(
		`Deleted UserProfileTable record ${targetProfile.profileId} (${profileLookupPath}).`,
	);
} else {
	console.log(`No UserProfileTable record found for ${emailNormalized}; skipping DynamoDB deletion.`);
}

console.log(
	[
		"",
		"Teacher cleanup complete.",
		`Cognito group ${TEACHER_GROUP} was not modified.`,
		"Use full stage teardown when you want to discard the entire localdev environment; use this script only for a single-account rollback.",
	].join("\n"),
);

function printPlan(args: {
	apply: boolean;
	emailNormalized: string;
	cognitoUser: CognitoUserState | null;
	targetProfile: TeacherProfileRecord | null;
	profileLookupPath: string;
}) {
	console.log(`${args.apply ? "Apply" : "Dry run"} plan:`);
	console.log(`1. Target teacher email: ${args.emailNormalized}`);

	if (args.cognitoUser) {
		console.log(
			`2. ${args.apply ? "Delete" : "Would delete"} Cognito user ${args.cognitoUser.username} (sub: ${args.cognitoUser.sub}, status: ${args.cognitoUser.status ?? "unknown"}, enabled: ${String(args.cognitoUser.enabled)}).`,
		);
		console.log(
			`3. Current Cognito groups: ${args.cognitoUser.groups.join(", ") || "(none)"}; the shared ${TEACHER_GROUP} group itself will not be deleted.`,
		);
	} else {
		console.log(`2. No Cognito user found for ${args.emailNormalized}.`);
		console.log(
			`3. The shared ${TEACHER_GROUP} group itself will not be deleted.`,
		);
	}

	if (args.targetProfile) {
		console.log(
			`4. ${args.apply ? "Delete" : "Would delete"} UserProfileTable record ${args.targetProfile.profileId} via ${args.profileLookupPath}.`,
		);
	} else {
		console.log(
			`4. No UserProfileTable record found for ${args.emailNormalized} by Cognito sub or EmailIndex.`,
		);
	}
}

async function getCognitoUser(
	email: string,
): Promise<CognitoUserState | null> {
	try {
		const response = await cognito.send(
			new AdminGetUserCommand({
				UserPoolId: userPoolId,
				Username: email,
			}),
		);
		const username =
			response.Username ??
			response.UserAttributes?.find((attribute) => attribute.Name === "email")
				?.Value ??
			email;
		const groups = await listUserGroups(username);

		return mapCognitoUser(response, groups);
	} catch (error) {
		if (errorName(error) === "UserNotFoundException") {
			return null;
		}

		throw error;
	}
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

async function listUserGroups(username: string) {
	const response = await cognito.send(
		new AdminListGroupsForUserCommand({
			UserPoolId: userPoolId,
			Username: username,
		}),
	);

	return response.Groups?.map((group) => group.GroupName ?? "").filter(Boolean) ?? [];
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

async function getProfilesByEmail(email: string) {
	const response = await dynamo.send(
		new QueryCommand({
			TableName: userProfileTableName,
			IndexName: "EmailIndex",
			KeyConditionExpression: "emailNormalized = :email",
			ExpressionAttributeValues: {
				":email": email,
			},
		}),
	);

	return (response.Items ?? []) as TeacherProfileRecord[];
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

function validateRequired(label: string, value: string) {
	if (!value) {
		fail(`Missing required --${label} value.`);
	}
}

function parseArgs(argv: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		email: "",
		apply: false,
		help: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		switch (arg) {
			case "--email":
				parsed.email = argv[++index] ?? "";
				break;
			case "--apply":
				parsed.apply = true;
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
	console.log(`Teacher bootstrap cleanup script

Usage:
  bunx sst shell --stage localdev -- bun scripts/cleanup-teacher.ts \\
    --email teacher@example.com

Options:
  --apply     Execute Cognito and DynamoDB deletes. Without this flag the script is a dry run.
  --help, -h  Show this help text.
`);
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function errorName(error: unknown) {
	return error instanceof Error ? error.name : undefined;
}
