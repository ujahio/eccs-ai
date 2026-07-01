import "server-only";

import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type {
	RegistrationEmailSender,
	RegistrationVerificationEmail
} from "@/features/auth/registration/email";

export class SesRegistrationEmailSender implements RegistrationEmailSender {
	private readonly client: SESv2Client;

	constructor(
		private readonly sender: string,
		client = new SESv2Client({})
	) {
		this.client = client;
	}

	async sendRegistrationVerificationEmail(
		email: RegistrationVerificationEmail
	) {
		await this.client.send(
			new SendEmailCommand({
				FromEmailAddress: this.sender,
				Destination: {
					ToAddresses: [email.to]
				},
				Content: {
					Simple: {
						Subject: {
							Data: "Verify your ECCS account"
						},
						Body: {
							Text: {
								Data: [
									`Hello ${email.firstName},`,
									"",
									"Please verify your E-Clinical Case Solutions account.",
									`This link expires in ${email.expiresInHours} hours:`,
									email.verificationUrl,
									"",
									"If you did not request this account, you can ignore this email."
								].join("\n")
							}
						}
					}
				}
			})
		);
	}
}
