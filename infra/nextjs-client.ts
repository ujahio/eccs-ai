const auth = await import("./auth");
const caseArchive = await import("./case-archive");
const caseMaterials = await import("./case-materials");
const secrets = await import("./secrets");
const tables = await import("./tables");

export const client = new sst.aws.Nextjs("eccsfeweb", {
	path: ".",
	environment: {
		AUTH_E2E_MODE: process.env.AUTH_E2E_MODE ?? "",
		BETTER_AUTH_URL:
			process.env.BETTER_AUTH_URL ??
			process.env.NEXT_PUBLIC_APP_URL ??
			"http://localhost:3001",
		CASE_ARCHIVE_SCHEDULE_GROUP_NAME:
			caseArchive.activeCaseArchiveScheduleGroupName,
		CASE_ARCHIVE_SCHEDULE_NAME: caseArchive.activeCaseArchiveScheduleName,
		CASE_ARCHIVE_SCHEDULER_ROLE_ARN: caseArchive.archiveSchedulerRoleArn,
		CASE_ARCHIVE_TARGET_ARN: caseArchive.archiveFunction.arn,
		NEXT_PUBLIC_APP_URL:
			process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
	},
	link: [
		auth.userPool,
		auth.userPoolClient,
		caseMaterials.caseMaterialBucket,
		secrets.betterAuthSecret,
		secrets.resendApiKey,
		tables.registrationWorkflowTable,
		tables.userProfileTable,
		tables.teacherCaseTable,
		tables.studentCertificateTable,
		tables.studentCaseCompletionTable,
		tables.studentQuizAttemptTable,
	],
	permissions: [
		{
			actions: ["scheduler:CreateSchedule", "scheduler:UpdateSchedule"],
			resources: [caseArchive.activeCaseArchiveScheduleArn],
		},
		{
			actions: ["iam:PassRole"],
			resources: [caseArchive.archiveSchedulerRoleArn],
			conditions: [
				{
					test: "StringEquals",
					variable: "iam:PassedToService",
					values: ["scheduler.amazonaws.com"],
				},
			],
		},
	],
	dev: {
		command: "bunx next dev -p 3001",
		url: "http://localhost:3001",
	},
});
