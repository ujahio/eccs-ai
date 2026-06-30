import "./.sst/platform/config.d.ts";

export default $config({
	app(input) {
		return {
			name: "eccs-ai",
			home: "aws",
			removal: input?.stage === "production" ? "retain" : "remove",
			protect: input?.stage === "production",
		};
	},
	async run() {
		await import("./infra/nextjs-client");
	},
});
