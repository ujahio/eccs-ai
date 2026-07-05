import "server-only";

import { Resend } from "resend";
import type { PasswordResetEmailSender } from "@/features/auth/password-reset/email";
import type {
	RegistrationEmailSender,
	RegistrationVerificationEmail,
} from "@/features/auth/registration/email";
import type { StudentProfileEmailSender } from "@/features/student/profile-security/service";

export class ResendRegistrationEmailSender
	implements
		RegistrationEmailSender,
		PasswordResetEmailSender,
		StudentProfileEmailSender
{
	private readonly client: Resend;

	constructor(
		private readonly sender: string,
		apiKey: string,
	) {
		this.client = new Resend(apiKey);
	}

	async sendRegistrationVerificationEmail(
		email: RegistrationVerificationEmail,
	) {
		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Verify your ECCS account",
			text: [
				`Hello ${email.firstName},`,
				"",
				"Please verify your E-Clinical Case Solutions account.",
				`This link expires in ${email.expiresInHours} hours:`,
				email.verificationUrl,
				"",
				"If you did not request this account, you can ignore this email.",
			].join("\n"),
		});
	}

	async sendPasswordResetCodeEmail(email: {
		to: string;
		resetUrl: string;
		expiresInMinutes: number;
	}) {
		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Reset your ECCS password",
			text: [
				"Please use this link to reset your E-Clinical Case Solutions password.",
				`This link expires in ${email.expiresInMinutes} minutes:`,
				email.resetUrl,
				"",
				"If you did not request a password reset, you can ignore this email."
			].join("\n")
		});
	}

	async sendPasswordChangedEmail(email: { to: string }) {
		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Your password was changed",
			text: [
				"Your E-Clinical Case Solutions password was changed.",
				"",
				"If you did not make this change, reset your password immediately."
			].join("\n")
		});
	}

	async sendEmailChangeVerificationEmail(email: {
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Verify your new ECCS email",
			text: [
				"Please verify this new email address for your E-Clinical Case Solutions account.",
				`This link expires in ${email.expiresInHours} hours:`,
				email.verificationUrl,
				"",
				"If you did not request this change, you can ignore this email."
			].join("\n")
		});
	}
}
