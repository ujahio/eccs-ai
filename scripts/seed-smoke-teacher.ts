import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	bootstrapTeacher,
	DEFAULT_TEST_TEACHER_MAILBOX_ENV,
} from "./teacher-bootstrap-core";

export const DEFAULT_SMOKE_TEACHER_TEMP_PASSWORD_ENV =
	"SMOKE_TEACHER_TEMP_PASSWORD";
export const DEFAULT_SMOKE_TEACHER_PASSWORD_ENV = "SMOKE_TEACHER_PASSWORD";

export type SmokeTeacherSeedCliArgs = {
	email: string;
	firstName: string;
	lastName: string;
	apply: boolean;
	temporaryPasswordEnv: string;
	permanentPasswordEnv: string;
	testTeacherMailboxEnv: string;
	help: boolean;
};

export function parseSmokeTeacherSeedArgs(
	argv: string[],
): SmokeTeacherSeedCliArgs {
	const parsed: SmokeTeacherSeedCliArgs = {
		email: "",
		firstName: "Smoke",
		lastName: "Teacher",
		apply: false,
		temporaryPasswordEnv: DEFAULT_SMOKE_TEACHER_TEMP_PASSWORD_ENV,
		permanentPasswordEnv: DEFAULT_SMOKE_TEACHER_PASSWORD_ENV,
		testTeacherMailboxEnv: DEFAULT_TEST_TEACHER_MAILBOX_ENV,
		help: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		switch (arg) {
			case "--email":
				parsed.email = readOptionValue(argv, ++index, "--email");
				break;
			case "--first-name":
				parsed.firstName = readOptionValue(argv, ++index, "--first-name");
				break;
			case "--last-name":
				parsed.lastName = readOptionValue(argv, ++index, "--last-name");
				break;
			case "--apply":
				parsed.apply = true;
				break;
			case "--temporary-password-env":
				parsed.temporaryPasswordEnv = readOptionValue(argv, ++index, arg);
				break;
			case "--permanent-password-env":
				parsed.permanentPasswordEnv = readOptionValue(argv, ++index, arg);
				break;
			case "--test-teacher-mailbox-env":
				parsed.testTeacherMailboxEnv = readOptionValue(argv, ++index, arg);
				break;
			case "--help":
			case "-h":
				parsed.help = true;
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return parsed;
}

export async function main(argv = process.argv.slice(2)) {
	try {
		const args = parseSmokeTeacherSeedArgs(argv);

		if (args.help) {
			printHelp();
			process.exit(0);
		}

		await bootstrapTeacher({
			email: args.email,
			firstName: args.firstName,
			lastName: args.lastName,
			apply: args.apply,
			replaceExistingTestTeacher: true,
			resetTemporaryPassword: true,
			passwordEnv: args.temporaryPasswordEnv,
			permanentPasswordEnv: args.permanentPasswordEnv,
			testTeacherMailboxEnv: args.testTeacherMailboxEnv,
		});
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

function readOptionValue(argv: string[], index: number, optionName: string) {
	const value = argv[index];

	if (!value || value.startsWith("--")) {
		throw new Error(`Missing required value for ${optionName}.`);
	}

	return value;
}

function printHelp() {
	console.log(`CI smoke teacher seed script

Usage:
  bunx sst shell --stage production-pr-42 -- bun scripts/seed-smoke-teacher.ts \\
    --email smoke-tests+teacher-production-pr-42@example.com

Options:
  --apply                     Execute Cognito and DynamoDB writes. Without this flag the script is a dry run.
  --first-name NAME           Teacher first name. Default: Smoke
  --last-name NAME            Teacher last name. Default: Teacher
  --temporary-password-env NAME
                              Environment variable that holds the temporary smoke teacher password. Default: ${DEFAULT_SMOKE_TEACHER_TEMP_PASSWORD_ENV}
  --permanent-password-env NAME
                              Environment variable that holds the permanent smoke teacher password used by Playwright. Default: ${DEFAULT_SMOKE_TEACHER_PASSWORD_ENV}
  --test-teacher-mailbox-env NAME
                              Environment variable that holds the controlled smoke mailbox. Default: ${DEFAULT_TEST_TEACHER_MAILBOX_ENV}
  --help, -h                  Show this help text.

Behavior:
  Deletes only generated smoke teacher identities for the controlled mailbox, refuses to touch stages with a real teacher identity, creates the teacher profile, and sets the permanent password for direct CI sign-in.
`);
}

function isMainModule() {
	return process.argv[1]
		? fileURLToPath(import.meta.url) === resolve(process.argv[1])
		: false;
}

if (isMainModule()) {
	await main();
}
