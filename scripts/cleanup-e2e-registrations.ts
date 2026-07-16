import {
	AdminDeleteUserCommand,
	CognitoIdentityProviderClient,
	paginateListUsers,
	type UserType
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	paginateScan
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

type PendingRegistrationItem = {
	emailNormalized?: string;
	status?: string;
};

type CleanupResources = {
	AuthUserPool: { id: string };
	RegistrationWorkflowTable: { name: string };
};

const args = new Set(process.argv.slice(2));
const shouldDelete = args.has("--confirm");
const prefix =
	process.argv
		.find((arg) => arg.startsWith("--prefix="))
		?.slice("--prefix=".length) ?? "e2e-test-";

const resources = Resource as unknown as CleanupResources;
const userPoolId = resources.AuthUserPool.id;
const registrationTableName = resources.RegistrationWorkflowTable.name;
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const clientConfig = region ? { region } : {};

const cognito = new CognitoIdentityProviderClient(clientConfig);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

const [cognitoUsers, pendingRegistrations] = await Promise.all([
	listCognitoUsers(),
	listPendingRegistrations()
]);

console.log(
	`${shouldDelete ? "Deleting" : "Dry run:"} ${cognitoUsers.length} Cognito users and ${pendingRegistrations.length} pending registration records with prefix "${prefix}".`
);

for (const user of cognitoUsers) {
	const username = user.Username;
	const email = getUserEmail(user);

	if (!username) {
		continue;
	}

	console.log(
		`${shouldDelete ? "Delete" : "Would delete"} Cognito user ${username}${email ? ` (${email})` : ""}`
	);

	if (shouldDelete) {
		await cognito.send(
			new AdminDeleteUserCommand({
				UserPoolId: userPoolId,
				Username: username
			})
		);
	}
}

for (const registration of pendingRegistrations) {
	if (!registration.emailNormalized) {
		continue;
	}

	console.log(
		`${shouldDelete ? "Delete" : "Would delete"} registration ${registration.emailNormalized}`
	);

	if (shouldDelete) {
		await dynamo.send(
			new DeleteCommand({
				TableName: registrationTableName,
				Key: { emailNormalized: registration.emailNormalized }
			})
		);
	}
}

console.log(
	shouldDelete
		? "Delete pass complete. Verifying cleanup..."
		: "Dry run complete. Re-run with --confirm to delete these resources."
);

if (shouldDelete) {
	const [remainingCognitoUsers, remainingRegistrations] = await Promise.all([
		listCognitoUsers(),
		listPendingRegistrations()
	]);

	if (remainingCognitoUsers.length > 0 || remainingRegistrations.length > 0) {
		console.error(
			`Cleanup verification failed: ${remainingCognitoUsers.length} Cognito users and ${remainingRegistrations.length} pending registration records still match prefix "${prefix}".`
		);

		for (const user of remainingCognitoUsers) {
			const email = getUserEmail(user);
			console.error(
				`Remaining Cognito user ${user.Username ?? "unknown"}${email ? ` (${email})` : ""}`
			);
		}

		for (const registration of remainingRegistrations) {
			console.error(
				`Remaining registration ${registration.emailNormalized ?? "unknown"}`
			);
		}

		process.exitCode = 1;
	} else {
		console.log("Confirmed: no matching E2E registration resources remain.");
	}
}

async function listCognitoUsers() {
	const users: UserType[] = [];

	for await (const page of paginateListUsers(
		{ client: cognito },
		{
			UserPoolId: userPoolId,
			Filter: `email ^= "${prefix}"`
		}
	)) {
		users.push(...(page.Users ?? []));
	}

	return users.filter((user) => getUserEmail(user)?.startsWith(prefix));
}

function getUserEmail(user: UserType) {
	return user.Attributes?.find((attribute) => attribute.Name === "email")?.Value;
}

async function listPendingRegistrations() {
	const registrations: PendingRegistrationItem[] = [];

	for await (const page of paginateScan(
		{ client: dynamo },
		{
			TableName: registrationTableName,
			FilterExpression:
				"begins_with(emailNormalized, :prefix) AND #status = :pending",
			ExpressionAttributeNames: {
				"#status": "status"
			},
			ExpressionAttributeValues: {
				":prefix": prefix,
				":pending": "pending"
			}
		}
	)) {
		registrations.push(...((page.Items ?? []) as PendingRegistrationItem[]));
	}

	return registrations;
}
