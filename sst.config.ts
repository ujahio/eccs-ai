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
		await import("./infra/secrets");
		await import("./infra/tables");
		await import("./infra/jobs");
		await import("./infra/nextjs-client");
	},
});
