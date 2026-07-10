import "server-only";

import {
	getE2EAuthStore,
	getE2EStudentCertificateStore,
	getE2ETeacherCaseStore,
} from "@/lib/e2e/in-memory-auth";
import {
	caseLifecycleEmailRecipientsFromProfiles,
	deadlineReminderCasesFromRecords,
} from "./records";
import type { CaseLifecycleNotificationRepository } from "./service";

export { DynamoCaseLifecycleNotificationRepository } from "./dynamo-repository";

export class InMemoryCaseLifecycleNotificationRepository
	implements CaseLifecycleNotificationRepository
{
	async listCaseLifecycleEmailRecipients() {
		return caseLifecycleEmailRecipientsFromProfiles(
			Array.from(getE2EAuthStore().profiles.values()),
		);
	}

	async listCasesReadyForDeadlineReminder(now: number) {
		return deadlineReminderCasesFromRecords(getE2ETeacherCaseStore(), now);
	}

	async hasEarnedActiveCaseCertificate({
		caseId,
		studentProfileId,
	}: {
		caseId: string;
		studentProfileId: string;
	}) {
		return getE2EStudentCertificateStore(studentProfileId).some(
			(certificate) => certificate.caseId === caseId,
		);
	}

	async markDeadlineReminderSent({
		caseId,
		sentAt,
	}: {
		caseId: string;
		sentAt: number;
	}) {
		const record = getE2EAuthStore().teacherCases.get(caseId);

		if (!record) {
			return;
		}

		getE2EAuthStore().teacherCases.set(caseId, {
			...record,
			deadlineReminderSentAt: sentAt,
		});
	}
}
