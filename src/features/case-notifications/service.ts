import type { AppRole } from "@/lib/auth/roles";

export const deadlineReminderLeadTimeMs = 48 * 60 * 60 * 1000;
export const deadlineReminderWindowMs = 60 * 60 * 1000;

export type CaseLifecycleNotificationCase = {
	caseId: string;
	deadlineAt: number;
	title: string;
};

export type CaseLifecycleEmailRecipient = {
	email: string;
	firstName: string;
	profileId: string;
};

export type CaseLifecycleEmailProfile = {
	role: AppRole;
	emailVerifiedAt?: number;
	canAccessCases?: boolean;
};

export type CaseLifecycleEmail = {
	caseTitle: string;
	deadlineAt: number;
	firstName: string;
	to: string;
};

export interface CaseLifecycleEmailSender {
	sendNewCasePublishedEmail(email: CaseLifecycleEmail): Promise<void>;
	sendDeadlineReminderEmail(email: CaseLifecycleEmail): Promise<void>;
}

export interface CaseLifecycleNotificationRepository {
	listCaseLifecycleEmailRecipients(): Promise<CaseLifecycleEmailRecipient[]>;
	listCasesReadyForDeadlineReminder(
		now: number,
	): Promise<CaseLifecycleNotificationCase[]>;
	hasEarnedActiveCaseCertificate(args: {
		caseId: string;
		studentProfileId: string;
	}): Promise<boolean>;
	markDeadlineReminderSent(args: {
		caseId: string;
		sentAt: number;
	}): Promise<void>;
}

export class CaseLifecycleNotificationService {
	constructor(
		private readonly repository: CaseLifecycleNotificationRepository,
		private readonly email: CaseLifecycleEmailSender,
	) {}

	async sendNewCasePublishedEmail(caseRecord: CaseLifecycleNotificationCase) {
		const recipients =
			await this.repository.listCaseLifecycleEmailRecipients();

		await Promise.all(
			recipients.map((recipient) =>
				this.email.sendNewCasePublishedEmail(
					emailFromCaseAndRecipient(caseRecord, recipient),
				),
			),
		);

		return { sent: recipients.length };
	}

	async sendDeadlineReminderEmails(now = Date.now()) {
		const cases =
			await this.repository.listCasesReadyForDeadlineReminder(now);
		let failed = 0;
		let sent = 0;

		for (const caseRecord of cases) {
			const recipients =
				await this.repository.listCaseLifecycleEmailRecipients();

			for (const recipient of recipients) {
				const hasCertificate =
					await this.repository.hasEarnedActiveCaseCertificate({
						caseId: caseRecord.caseId,
						studentProfileId: recipient.profileId,
					});

				if (hasCertificate) {
					continue;
				}

				try {
					await this.email.sendDeadlineReminderEmail(
						emailFromCaseAndRecipient(caseRecord, recipient),
					);
					sent += 1;
				} catch {
					failed += 1;
				}
			}

			await this.repository.markDeadlineReminderSent({
				caseId: caseRecord.caseId,
				sentAt: now,
			});
		}

		return { casesChecked: cases.length, failed, sent };
	}
}

export function isEligibleForCaseLifecycleEmail(
	profile: CaseLifecycleEmailProfile,
) {
	return (
		profile.role === "student" &&
		typeof profile.emailVerifiedAt === "number" &&
		profile.emailVerifiedAt > 0 &&
		profile.canAccessCases !== false
	);
}

export function isInDeadlineReminderWindow(
	caseRecord: {
		deadlineAt: number;
		deadlineReminderSentAt?: number;
	},
	now: number,
) {
	if (typeof caseRecord.deadlineReminderSentAt === "number") {
		return false;
	}

	const reminderWindowOpensAt =
		now + deadlineReminderLeadTimeMs - deadlineReminderWindowMs;
	const reminderWindowClosesAt = now + deadlineReminderLeadTimeMs;

	return (
		caseRecord.deadlineAt >= reminderWindowOpensAt &&
		caseRecord.deadlineAt <= reminderWindowClosesAt
	);
}

function emailFromCaseAndRecipient(
	caseRecord: CaseLifecycleNotificationCase,
	recipient: CaseLifecycleEmailRecipient,
): CaseLifecycleEmail {
	return {
		to: recipient.email,
		firstName: recipient.firstName,
		caseTitle: caseRecord.title,
		deadlineAt: caseRecord.deadlineAt,
	};
}
