import "server-only";

import { Resend } from "resend";
import type {
	RegistrationEmailSender,
	RegistrationVerificationEmail,
} from "@/features/auth/registration/email";

export class ResendRegistrationEmailSender implements RegistrationEmailSender {
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
}
