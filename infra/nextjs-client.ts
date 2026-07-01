const auth = await import("./auth");
const email = await import("./email");
const tables = await import("./tables");

export const client = new sst.aws.Nextjs("eccsfeweb", {
	path: ".",
	link: [
		auth.userPool,
		auth.userPoolClient,
		tables.registrationWorkflowTable,
		tables.userProfileTable,
		email.transactionalEmail
	],
	dev: {
		command: "bunx next dev -p 3001",
		url: "http://localhost:3001",
	},
});
