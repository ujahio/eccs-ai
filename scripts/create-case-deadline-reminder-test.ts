import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	InvokeCommand,
	LambdaClient,
	ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

type ReminderTestResources = {
	TeacherCaseTable: { name: string };
};

type ParsedArgs = {
	apply: boolean;
	caseId: string;
	delete: boolean;
	functionName: string;
	help: boolean;
	invokeReminder: boolean;
	minutes: number;
	teacherProfileId: string;
	title: string;
};

type ReminderTestCaseRecord = {
	caseId: string;
	completionCount: number;
	deadlineAt: number;
	draft: {
		attachments: [];
		cmeQuestions: Array<{
			correctOptionId: string;
			id: string;
			options: Array<{ id: string; text: string }>;
			prompt: string;
		}>;
		deadlineDate: string;
		description: string;
		lectureText: string;
		modelAnswer: string;
		presentation: string;
		title: string;
	};
	feedbackCount: number;
	lifecycle: "published";
	publishedAt: number;
	recordType: "case";
	teacherProfileId: string;
	testSeededFor: string;
	title: string;
};

const defaultMinutes = 2;
const defaultTeacherProfileId = "reminder-test-script";
const defaultTitle = "Reminder email test case";
const oneMinuteMs = 60 * 1000;
const reminderFunctionNamePattern = "CaseDeadlineReminderJobHandlerFunction";
const teacherCaseRecordType = "case";
const testSeededFor = "case-deadline-reminder-email";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
	printHelp();
	process.exit(0);
}

validateArgs(args);

const resources = Resource as unknown as ReminderTestResources;
const tableName = resources.TeacherCaseTable.name;
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const clientConfig = region ? { region } : {};
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));
const lambda = new LambdaClient(clientConfig);

if (args.delete) {
	await deleteReminderTestCase(args.caseId, args.apply);
	process.exit(0);
}

const now = Date.now();
const deadlineAt = now + args.minutes * oneMinuteMs;
const caseId = args.caseId || `reminder-test-${randomUUID()}`;
const record = reminderTestCaseRecord({
	caseId,
	deadlineAt,
	now,
	teacherProfileId: args.teacherProfileId,
	title: args.title,
});

printPlan({
	apply: args.apply,
	deadlineAt,
	minutes: args.minutes,
	now,
	record,
});

if (!args.apply) {
	console.log(
		"Dry run only. Re-run with --apply to create this published reminder test case item.",
	);
	process.exit(0);
}

try {
	await dynamo.send(
		new PutCommand({
			TableName: tableName,
			Item: record,
			ConditionExpression: "attribute_not_exists(caseId)",
		}),
	);
} catch (error) {
	if (errorName(error) === "ConditionalCheckFailedException") {
		fail(`Refusing to overwrite existing teacher case item ${caseId}.`);
	}

	throw error;
}

console.log("");
console.log("Reminder test case item created.");
console.log(`Case ID: ${caseId}`);
console.log(`Deadline: ${formatInstant(deadlineAt)}`);
if (args.invokeReminder) {
	await invokeReminderJob(args.functionName);
} else {
	console.log(
		"Run this script with --invoke-reminder to invoke the deadline reminder Lambda automatically.",
	);
}
printCleanupInstructions(caseId);

async function deleteReminderTestCase(caseId: string, apply: boolean) {
	console.log(`${apply ? "Apply" : "Dry run"} cleanup plan:`);
	console.log(`1. Teacher case table: ${tableName}`);
	console.log(`2. Delete reminder test case item: ${caseId}`);
	console.log(
		`3. Only delete if testSeededFor equals "${testSeededFor}".`,
	);

	if (!apply) {
		console.log(
			"Dry run only. Re-run with --delete --apply to remove this test case item.",
		);
		return;
	}

	try {
		await dynamo.send(
			new DeleteCommand({
				TableName: tableName,
				Key: { caseId },
				ConditionExpression: "#testSeededFor = :testSeededFor",
				ExpressionAttributeNames: {
					"#testSeededFor": "testSeededFor",
				},
				ExpressionAttributeValues: {
					":testSeededFor": testSeededFor,
				},
			}),
		);
	} catch (error) {
		if (errorName(error) === "ConditionalCheckFailedException") {
			fail(
				`Refusing to delete ${caseId}; it is missing the expected reminder-test marker.`,
			);
		}

		throw error;
	}

	console.log("");
	console.log(`Removed reminder test case item ${caseId}.`);
}

function reminderTestCaseRecord({
	caseId,
	deadlineAt,
	now,
	teacherProfileId,
	title,
}: {
	caseId: string;
	deadlineAt: number;
	now: number;
	teacherProfileId: string;
	title: string;
}): ReminderTestCaseRecord {
	const description =
		"Temporary published case seeded directly for deadline reminder email testing.";

	return {
		caseId,
		completionCount: 0,
		deadlineAt,
		draft: {
			attachments: [],
			cmeQuestions: [
				testQuestion(1),
				testQuestion(2),
				testQuestion(3),
			],
			deadlineDate: new Date(deadlineAt).toISOString().slice(0, 10),
			description,
			lectureText:
				"This temporary lecture text exists only so the seeded published case resembles a normal case record during reminder email testing.",
			modelAnswer:
				"This temporary model answer exists only so the seeded published case resembles a normal case record during reminder email testing.",
			presentation:
				"This temporary presentation exists only so the seeded published case resembles a normal case record during reminder email testing.",
			title,
		},
		feedbackCount: 0,
		lifecycle: "published",
		publishedAt: now,
		recordType: teacherCaseRecordType,
		teacherProfileId,
		testSeededFor,
		title,
	};
}

function testQuestion(index: number) {
	return {
		correctOptionId: `test-option-${index}-a`,
		id: `test-question-${index}`,
		options: [
			{
				id: `test-option-${index}-a`,
				text: "This is the seeded test answer.",
			},
			{
				id: `test-option-${index}-b`,
				text: "This is another seeded test answer.",
			},
		],
		prompt: `Seeded reminder email test question ${index}?`,
	};
}

function printPlan({
	apply,
	deadlineAt,
	minutes,
	now,
	record,
}: {
	apply: boolean;
	deadlineAt: number;
	minutes: number;
	now: number;
	record: ReminderTestCaseRecord;
}) {
	console.log(`${apply ? "Apply" : "Dry run"} plan:`);
	console.log(`1. Teacher case table: ${tableName}`);
	console.log(`2. Create published test case item: ${record.caseId}`);
	console.log(`3. Title: ${record.title}`);
	console.log(`4. Teacher profile ID marker: ${record.teacherProfileId}`);
	console.log(
		`5. deadlineAt: ${deadlineAt} (${formatInstant(deadlineAt)}), ${minutes} minute${minutes === 1 ? "" : "s"} from ${formatInstant(now)}.`,
	);
	console.log("6. deadlineReminderSentAt will be absent.");
	console.log("7. Existing drafts and active-case lock will not be touched.");
	if (args.invokeReminder) {
		console.log(
			`8. Invoke reminder Lambda ${args.functionName || `matching "${reminderFunctionNamePattern}"`}.`,
		);
	}
}

async function invokeReminderJob(explicitFunctionName: string) {
	const functionName =
		explicitFunctionName || (await findDeadlineReminderFunctionName());

	console.log("");
	console.log(`Invoking reminder Lambda: ${functionName}`);

	const response = await lambda.send(
		new InvokeCommand({
			FunctionName: functionName,
			Payload: JSON.stringify({}),
		}),
	);
	const payload = response.Payload
		? Buffer.from(response.Payload).toString("utf8")
		: "";

	console.log(`Lambda status code: ${response.StatusCode ?? "(unknown)"}`);

	if (response.FunctionError) {
		console.log(`Lambda function error: ${response.FunctionError}`);
	}

	if (payload) {
		console.log(`Lambda payload: ${payload}`);
	}
}

async function findDeadlineReminderFunctionName() {
	const matches: string[] = [];
	let marker: string | undefined;

	do {
		const response = await lambda.send(
			new ListFunctionsCommand({
				Marker: marker,
			}),
		);

		for (const fn of response.Functions ?? []) {
			const name = fn.FunctionName ?? "";

			if (name.includes(reminderFunctionNamePattern)) {
				matches.push(name);
			}
		}

		marker = response.NextMarker;
	} while (marker);

	if (matches.length === 1) {
		return matches[0]!;
	}

	if (matches.length === 0) {
		fail(
			`Could not find a Lambda function containing "${reminderFunctionNamePattern}". Pass --function-name explicitly if the function was renamed.`,
		);
	}

	fail(
		[
			`Found ${matches.length} matching reminder Lambda functions. Pass --function-name with the one to invoke:`,
			...matches.map((name) => `- ${name}`),
		].join("\n"),
	);
}

function parseArgs(argv: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		apply: false,
		caseId: "",
		delete: false,
		functionName: "",
		help: false,
		invokeReminder: false,
		minutes: defaultMinutes,
		teacherProfileId: defaultTeacherProfileId,
		title: defaultTitle,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		switch (arg) {
			case "--apply":
				parsed.apply = true;
				break;
			case "--case-id":
				parsed.caseId = argv[++index] ?? "";
				break;
			case "--delete":
				parsed.delete = true;
				break;
			case "--function-name":
				parsed.functionName = argv[++index] ?? "";
				break;
			case "--invoke-reminder":
				parsed.invokeReminder = true;
				break;
			case "--minutes":
				parsed.minutes = Number(argv[++index] ?? "");
				break;
			case "--teacher-profile-id":
				parsed.teacherProfileId = argv[++index] ?? defaultTeacherProfileId;
				break;
			case "--title":
				parsed.title = argv[++index] ?? defaultTitle;
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

function validateArgs(parsed: ParsedArgs) {
	if (parsed.delete && !parsed.caseId.trim()) {
		fail("--delete requires --case-id.");
	}

	if (!Number.isFinite(parsed.minutes) || parsed.minutes <= 0) {
		fail("--minutes must be a positive number.");
	}

	if (!parsed.teacherProfileId.trim()) {
		fail("--teacher-profile-id must not be blank.");
	}

	if (!parsed.title.trim()) {
		fail("--title must not be blank.");
	}
}

function printHelp() {
	console.log(`Create a temporary published case item for reminder email testing.

Usage:
  bunx sst shell --stage ailocal -- bun scripts/create-case-deadline-reminder-test.ts \\
    --minutes 2 \\
    --invoke-reminder \\
    --apply

Cleanup after testing:
  bunx sst shell --stage ailocal -- bun scripts/create-case-deadline-reminder-test.ts \\
    --delete \\
    --case-id <created-case-id> \\
    --apply

Options:
  --case-id ID             Optional case ID. Default: generated reminder-test UUID.
  --delete                 Delete a previously-created reminder test item. Requires --case-id.
  --function-name NAME     Optional exact reminder Lambda function name when multiple stages match.
  --invoke-reminder        Invoke the deadline reminder Lambda after creating the test case item.
  --minutes N              Minutes from now for the temporary deadline. Default: ${defaultMinutes}
  --teacher-profile-id ID  Marker teacher profile ID. Default: ${defaultTeacherProfileId}
  --title TEXT             Case title used in reminder emails. Default: "${defaultTitle}"
  --apply                  Execute DynamoDB write. Without this flag the script is a dry run.
  --help, -h               Show this help text.
`);
}

function printCleanupInstructions(caseId: string) {
	console.log("");
	console.log("Cleanup after testing:");
	console.log(
		`bunx sst shell --stage ailocal -- bun scripts/create-case-deadline-reminder-test.ts --delete --case-id ${caseId} --apply`,
	);
}

function formatInstant(value: number) {
	return new Date(value).toISOString();
}

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function errorName(error: unknown) {
	return typeof error === "object" &&
		error !== null &&
		"name" in error &&
		typeof error.name === "string"
		? error.name
		: undefined;
}
