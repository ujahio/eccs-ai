export const resendApiKey = new sst.Secret(
	"ResendApiKey",
	process.env.RESEND_API_KEY,
);

export const betterAuthSecret = new sst.Secret(
	"BetterAuthSecret",
	process.env.BETTER_AUTH_SECRET,
);
