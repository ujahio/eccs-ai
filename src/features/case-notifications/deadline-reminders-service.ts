import { DynamoCaseLifecycleNotificationRepository } from "./dynamo-repository";
import { CaseLifecycleNotificationService } from "./service";

export async function getCaseDeadlineReminderService() {
	const [{ ResendRegistrationEmailSender }, { getCaseNotificationResources }] =
		await Promise.all([import("@/lib/aws/email"), import("@/lib/aws/resources")]);
	const resources = getCaseNotificationResources();

	return new CaseLifecycleNotificationService(
		new DynamoCaseLifecycleNotificationRepository(
			resources.userProfileTableName,
			resources.teacherCaseTableName,
			resources.studentCertificateTableName,
		),
		new ResendRegistrationEmailSender(
			resources.emailSender,
			resources.resendApiKey,
			resources.appBaseUrl,
		),
	);
}
