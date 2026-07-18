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
		await import("./infra/auth");
		await import("./infra/case-materials");
		await import("./infra/secrets");
		await import("./infra/tables");
		await import("./infra/case-archive");
		await import("./infra/jobs");
	},
});
