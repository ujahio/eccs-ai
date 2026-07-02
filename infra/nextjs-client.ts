const auth = await import("./auth");
const secrets = await import("./secrets");
const tables = await import("./tables");

export const client = new sst.aws.Nextjs("eccsfeweb", {
	path: ".",
	link: [
		auth.userPool,
		auth.userPoolClient,
		secrets.resendApiKey,
		tables.registrationWorkflowTable,
		tables.userProfileTable,
	],
	dev: {
		command: "bunx next dev -p 3001",
		url: "http://localhost:3001",
	},
});
