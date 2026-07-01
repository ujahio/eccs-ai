export type RegistrationVerificationEmail = {
	to: string;
	firstName: string;
	verificationUrl: string;
	expiresInHours: number;
};

export interface RegistrationEmailSender {
	sendRegistrationVerificationEmail(
		email: RegistrationVerificationEmail
	): Promise<void>;
}
