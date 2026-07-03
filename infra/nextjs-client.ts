const auth = await import("./auth");
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
		NEXT_PUBLIC_APP_URL:
			process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
	},
	link: [
		auth.userPool,
		auth.userPoolClient,
		secrets.betterAuthSecret,
		secrets.resendApiKey,
		tables.registrationWorkflowTable,
		tables.userProfileTable,
	],
	dev: {
		command: "bunx next dev -p 3001",
		url: "http://localhost:3001",
	},
});
