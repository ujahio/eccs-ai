import { userPool, userPoolClient } from "./auth";
import { registrationWorkflowTable, userProfileTable } from "./tables";
import { transactionalEmail } from "./email";

export const registrationCleanupJob = new sst.aws.CronV2(
	"RegistrationCleanupJob",
	{
		schedule: "rate(1 hour)",
		function: {
			handler: "src/features/auth/registration/cleanup.handler",
			link: [
				userPool,
				userPoolClient,
				registrationWorkflowTable,
				userProfileTable,
				transactionalEmail
			]
		}
	}
);
