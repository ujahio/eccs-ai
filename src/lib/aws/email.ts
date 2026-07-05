import "server-only";

import { Resend } from "resend";
import type { PasswordResetEmailSender } from "@/features/auth/password-reset/email";
import type {
	RegistrationEmailSender,
	RegistrationVerificationEmail,
} from "@/features/auth/registration/email";
import type { StudentProfileEmailSender } from "@/features/student/profile-security/service";
import {
	emailLogoUrl,
	forgotPasswordUrl,
	renderEmailChangeVerificationEmail,
	renderPasswordChangedEmail,
	renderPasswordResetEmail,
	renderRegistrationVerificationEmail,
} from "@/lib/email-templates/transactional";

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
		private readonly appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ??
			"http://localhost:3001"
	) {
		this.client = new Resend(apiKey);
	}

	async sendRegistrationVerificationEmail(
		email: RegistrationVerificationEmail,
	) {
		const content = await renderRegistrationVerificationEmail({
			firstName: email.firstName,
			verificationUrl: email.verificationUrl,
			expiresInHours: email.expiresInHours,
			logoUrl: emailLogoUrl(this.appBaseUrl),
		});

		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Verify your ECCS account",
			html: content.html,
			text: content.text
		});
	}

	async sendPasswordResetCodeEmail(email: {
		to: string;
		resetUrl: string;
		expiresInMinutes: number;
	}) {
		const content = await renderPasswordResetEmail({
			resetUrl: email.resetUrl,
			expiresInMinutes: email.expiresInMinutes,
			logoUrl: emailLogoUrl(this.appBaseUrl),
		});

		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Reset your ECCS password",
			html: content.html,
			text: content.text
		});
	}

	async sendPasswordChangedEmail(email: { to: string }) {
		const content = await renderPasswordChangedEmail({
			forgotPasswordUrl: forgotPasswordUrl(this.appBaseUrl),
			logoUrl: emailLogoUrl(this.appBaseUrl),
		});

		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Your password was changed",
			html: content.html,
			text: content.text
		});
	}

	async sendEmailChangeVerificationEmail(email: {
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		const content = await renderEmailChangeVerificationEmail({
			verificationUrl: email.verificationUrl,
			expiresInHours: email.expiresInHours,
			logoUrl: emailLogoUrl(this.appBaseUrl),
		});

		await this.client.emails.send({
			from: this.sender,
			to: email.to,
			subject: "Verify your new ECCS email",
			html: content.html,
			text: content.text
		});
	}
}
