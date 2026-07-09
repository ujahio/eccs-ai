const auth = await import("./auth");
const secrets = await import("./secrets");
const tables = await import("./tables");

export const registrationCleanupJob = new sst.aws.CronV2(
	"RegistrationCleanupJob",
	{
		schedule: "rate(1 hour)",
		function: {
			handler: "src/features/auth/registration/cleanup.handler",
			link: [
				auth.userPool,
				auth.userPoolClient,
				secrets.resendApiKey,
				tables.registrationWorkflowTable,
				tables.userProfileTable,
			],
		},
	},
);

export const caseDeadlineReminderJob = new sst.aws.CronV2(
	"CaseDeadlineReminderJob",
	{
		schedule: "rate(1 hour)",
		function: {
			dev: false,
			handler: "src/features/case-notifications/deadline-reminders.handler",
			link: [
				secrets.resendApiKey,
				tables.userProfileTable,
				tables.teacherCaseTable,
				tables.studentCertificateTable,
			],
		},
	},
);
