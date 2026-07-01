const auth = await import("./auth");
const tables = await import("./tables");
const email = await import("./email");

export const registrationCleanupJob = new sst.aws.CronV2(
	"RegistrationCleanupJob",
	{
		schedule: "rate(1 hour)",
		function: {
			handler: "src/features/auth/registration/cleanup.handler",
			link: [
				auth.userPool,
				auth.userPoolClient,
				tables.registrationWorkflowTable,
				tables.userProfileTable,
				email.transactionalEmail
			]
		}
	}
);
