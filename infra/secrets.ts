export const resendApiKey = new sst.Secret(
	"ResendApiKey",
	process.env.RESEND_API_KEY,
);
