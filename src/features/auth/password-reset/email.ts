export type PasswordResetCodeEmail = {
	to: string;
	resetUrl: string;
	expiresInMinutes: number;
};

export type PasswordChangedEmail = {
	to: string;
};

export interface PasswordResetEmailSender {
	sendPasswordResetCodeEmail(email: PasswordResetCodeEmail): Promise<void>;
	sendPasswordChangedEmail(email: PasswordChangedEmail): Promise<void>;
}
