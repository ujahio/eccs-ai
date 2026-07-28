export default $config({
	app() {
		return {
			name: "eccs-ai",
			home: "aws",
			removal: "remove",
		};
	},
	async run() {
		await import("./infra/auth");
		await import("./infra/case-materials");
		await import("./infra/secrets");
		await import("./infra/tables");
		await import("./infra/case-archive");
		await import("./infra/jobs");
		await import("./infra/nextjs-client");
	},
});
