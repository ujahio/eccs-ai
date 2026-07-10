import "server-only";

import { ResendRegistrationEmailSender } from "@/lib/aws/email";
import { getCaseNotificationResources } from "@/lib/aws/resources";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";
import {
	DynamoCaseLifecycleNotificationRepository,
	InMemoryCaseLifecycleNotificationRepository,
} from "./repository";
import { CaseLifecycleNotificationService } from "./service";

export function getCaseLifecycleNotificationService() {
	if (isE2EMode()) {
		return new CaseLifecycleNotificationService(
			new InMemoryCaseLifecycleNotificationRepository(),
			getE2EAdapters().email,
		);
	}

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
