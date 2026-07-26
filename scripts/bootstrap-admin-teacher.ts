import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	bootstrapTeacher,
	DEFAULT_TEACHER_TEMP_PASSWORD_ENV,
	DEFAULT_TEST_TEACHER_MAILBOX_ENV,
} from "./teacher-bootstrap-core";

export type AdminTeacherBootstrapCliArgs = {
	email: string;
	firstName: string;
	lastName: string;
	apply: boolean;
	temporaryPasswordEnv: string;
	help: boolean;
};

export function parseAdminTeacherBootstrapArgs(
	argv: string[],
): AdminTeacherBootstrapCliArgs {
	const parsed: AdminTeacherBootstrapCliArgs = {
		email: "",
		firstName: "",
		lastName: "",
		apply: false,
		temporaryPasswordEnv: DEFAULT_TEACHER_TEMP_PASSWORD_ENV,
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
			case "--password-env":
				parsed.temporaryPasswordEnv = readOptionValue(
					argv,
					++index,
					arg,
				);
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
		const args = parseAdminTeacherBootstrapArgs(argv);

		if (args.help) {
			printHelp();
			process.exit(0);
		}

		await bootstrapTeacher({
			email: args.email,
			firstName: args.firstName,
			lastName: args.lastName,
			apply: args.apply,
			replaceExistingTestTeacher: false,
			resetTemporaryPassword: true,
			passwordEnv: args.temporaryPasswordEnv,
			permanentPasswordEnv: null,
			testTeacherMailboxEnv: DEFAULT_TEST_TEACHER_MAILBOX_ENV,
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
	console.log(`Admin teacher bootstrap script

Usage:
  bunx sst shell --stage staging -- bun scripts/bootstrap-admin-teacher.ts \\
    --email teacher@example.com \\
    --first-name Taylor \\
    --last-name Smith

Options:
  --apply                     Execute Cognito and DynamoDB writes. Without this flag the script is a dry run.
  --temporary-password-env NAME
                              Environment variable that holds the temporary teacher password. Default: ${DEFAULT_TEACHER_TEMP_PASSWORD_ENV}
  --password-env NAME         Alias for --temporary-password-env.
  --help, -h                  Show this help text.

Behavior:
  Creates or reconciles the single v1 teacher account, verifies the email attribute, mirrors the teacher profile, and always sets a fresh temporary password that Cognito requires the teacher to change on first login.
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
