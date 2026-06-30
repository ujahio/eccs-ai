export const client = new sst.aws.Nextjs("eccsfeweb", {
	path: ".",
	dev: {
		command: "bunx next dev -p 3001",
		url: "http://localhost:3001",
	},
});
