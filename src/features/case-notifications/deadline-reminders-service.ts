import { Resend, type CreateEmailResponse } from "resend";
import { Resource } from "sst";
import { eccsLogoAttachment } from "@/lib/email-templates/logo-attachment";
import {
	renderCaseDeadlineReminderEmail,
	studentDashboardUrl,
} from "@/lib/email-templates/transactional";
import { DynamoCaseLifecycleNotificationRepository } from "./dynamo-repository";
import {
	CaseLifecycleNotificationService,
	type CaseDeadlineReminderEmailSender,
	type CaseLifecycleEmail,
} from "./service";

type CaseDeadlineReminderResources = {
	ResendApiKey: { value: string };
	UserProfileTable: { name: string };
	TeacherCaseTable: { name: string };
	StudentCertificateTable: { name: string };
};

const linkedResources =
	Resource as unknown as Partial<CaseDeadlineReminderResources>;

export function getCaseDeadlineReminderService() {
	return new CaseLifecycleNotificationService(
		new DynamoCaseLifecycleNotificationRepository(
			required(
				linkedValue(() => linkedResources.UserProfileTable?.name),
				"UserProfileTable.name",
			),
			required(
				linkedValue(() => linkedResources.TeacherCaseTable?.name),
				"TeacherCaseTable.name",
			),
			required(
				linkedValue(() => linkedResources.StudentCertificateTable?.name),
				"StudentCertificateTable.name",
			),
		),
		{
			deadlineReminder: new ResendDeadlineReminderEmailSender(
				process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
				required(
					linkedValue(() => linkedResources.ResendApiKey?.value),
					"ResendApiKey.value",
				),
				process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
			),
		},
	);
}

class ResendDeadlineReminderEmailSender
	implements CaseDeadlineReminderEmailSender
{
	private readonly client: Resend;

	constructor(
		private readonly sender: string,
		apiKey: string,
		private readonly appBaseUrl: string,
	) {
		this.client = new Resend(apiKey);
	}

	async sendDeadlineReminderEmail(email: CaseLifecycleEmail) {
		const content = await renderCaseDeadlineReminderEmail({
			caseTitle: email.caseTitle,
			deadlineAt: email.deadlineAt,
			firstName: email.firstName,
			studentDashboardUrl: studentDashboardUrl(this.appBaseUrl),
		});

		await sendResendEmail(
			this.client.emails.send({
				attachments: [eccsLogoAttachment()],
				from: this.sender,
				to: email.to,
				subject: "Complete your ECCS case before it closes",
				html: content.html,
				text: content.text,
			}),
		);
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

function required(value: string | undefined, label: string) {
	if (!value) {
		throw new Error(`Missing required deadline reminder resource: ${label}`);
	}

	return value;
}

function linkedValue(read: () => string | undefined) {
	try {
		return read();
	} catch {
		return undefined;
	}
}
