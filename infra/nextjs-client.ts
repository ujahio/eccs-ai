import { userPool, userPoolClient } from "./auth";
import { transactionalEmail } from "./email";
import { registrationWorkflowTable, userProfileTable } from "./tables";

export const client = new sst.aws.Nextjs("eccsfeweb", {
	path: ".",
	link: [
		userPool,
		userPoolClient,
		registrationWorkflowTable,
		userProfileTable,
		transactionalEmail
	],
	dev: {
		command: "bunx next dev -p 3001",
		url: "http://localhost:3001",
	},
});
