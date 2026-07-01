export const transactionalEmail = new sst.aws.Email("TransactionalEmail", {
	sender: process.env.ECCS_EMAIL_SENDER ?? "no-reply@example.com",
	dns: false
});
