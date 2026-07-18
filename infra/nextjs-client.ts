import {
	webRuntimeEnvironment,
	webRuntimeLinks,
	webRuntimeSchedulerPermissions,
} from "./web-runtime";

export const client = new sst.aws.Nextjs("eccsfeweb", {
	path: ".",
	environment: webRuntimeEnvironment,
	link: webRuntimeLinks,
	permissions: webRuntimeSchedulerPermissions,
	dev: {
		command: "bunx next dev -p 3001",
		url: "http://localhost:3001",
	},
});
