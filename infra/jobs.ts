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
