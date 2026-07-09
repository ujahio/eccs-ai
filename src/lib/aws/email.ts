import "server-only";

import { Resend, type CreateEmailResponse } from "resend";
import type { PasswordResetEmailSender } from "@/features/auth/password-reset/email";
import type {
	RegistrationEmailSender,
	RegistrationVerificationEmail,
} from "@/features/auth/registration/email";
import type {
	CaseLifecycleEmail,
	CaseLifecycleEmailSender,
} from "@/features/case-notifications/service";
import type { ProfileSecurityEmailSender } from "@/features/profile-security/service";
import { eccsLogoAttachment } from "@/lib/email-templates/logo-attachment";
import {
	forgotPasswordUrl,
	renderCaseDeadlineReminderEmail,
	renderCasePublishedEmail,
	renderEmailChangeVerificationEmail,
	renderPasswordChangedEmail,
	renderPasswordResetEmail,
	renderRegistrationVerificationEmail,
	studentDashboardUrl,
} from "@/lib/email-templates/transactional";

export class ResendRegistrationEmailSender
	implements
		RegistrationEmailSender,
		PasswordResetEmailSender,
		ProfileSecurityEmailSender,
		CaseLifecycleEmailSender
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
			expiresInHours: email.expiresInHours
		});

		await sendResendEmail(this.client.emails.send({
			attachments: [eccsLogoAttachment()],
			from: this.sender,
			to: email.to,
			subject: "Verify your ECCS account",
			html: content.html,
			text: content.text
		}));
	}

	async sendPasswordResetCodeEmail(email: {
		to: string;
		resetUrl: string;
		expiresInMinutes: number;
	}) {
		const content = await renderPasswordResetEmail({
			resetUrl: email.resetUrl,
			expiresInMinutes: email.expiresInMinutes
		});

		await sendResendEmail(this.client.emails.send({
			attachments: [eccsLogoAttachment()],
			from: this.sender,
			to: email.to,
			subject: "Reset your ECCS password",
			html: content.html,
			text: content.text
		}));
	}

	async sendPasswordChangedEmail(email: { to: string }) {
		const content = await renderPasswordChangedEmail({
			forgotPasswordUrl: forgotPasswordUrl(this.appBaseUrl)
		});

		await sendResendEmail(this.client.emails.send({
			attachments: [eccsLogoAttachment()],
			from: this.sender,
			to: email.to,
			subject: "Your password was changed",
			html: content.html,
			text: content.text
		}));
	}

	async sendEmailChangeVerificationEmail(email: {
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		const content = await renderEmailChangeVerificationEmail({
			verificationUrl: email.verificationUrl,
			expiresInHours: email.expiresInHours
		});

		await sendResendEmail(this.client.emails.send({
			attachments: [eccsLogoAttachment()],
			from: this.sender,
			to: email.to,
			subject: "Verify your new ECCS email",
			html: content.html,
			text: content.text
		}));
	}

	async sendNewCasePublishedEmail(email: CaseLifecycleEmail) {
		const content = await renderCasePublishedEmail({
			caseTitle: email.caseTitle,
			deadlineAt: email.deadlineAt,
			firstName: email.firstName,
			studentDashboardUrl: studentDashboardUrl(this.appBaseUrl),
		});

		await sendResendEmail(this.client.emails.send({
			attachments: [eccsLogoAttachment()],
			from: this.sender,
			to: email.to,
			subject: `New ECCS case available: ${email.caseTitle}`,
			html: content.html,
			text: content.text
		}));
	}

	async sendDeadlineReminderEmail(email: CaseLifecycleEmail) {
		const content = await renderCaseDeadlineReminderEmail({
			caseTitle: email.caseTitle,
			deadlineAt: email.deadlineAt,
			firstName: email.firstName,
			studentDashboardUrl: studentDashboardUrl(this.appBaseUrl),
		});

		await sendResendEmail(this.client.emails.send({
			attachments: [eccsLogoAttachment()],
			from: this.sender,
			to: email.to,
			subject: `48-hour ECCS case reminder: ${email.caseTitle}`,
			html: content.html,
			text: content.text
		}));
	}
}

async function sendResendEmail(send: Promise<CreateEmailResponse>) {
	const response = await send;

	if (response.error) {
		throw new Error(
			`Resend email failed: ${response.error.name}: ${response.error.message}`,
		);
	}
}
