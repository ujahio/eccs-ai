import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CaseLifecycleNotificationService,
	deadlineReminderLeadTimeMs,
	isEligibleForCaseLifecycleEmail,
	isReadyForDeadlineReminder,
	oneHourMs,
	type CaseLifecycleEmailSender,
	type CaseLifecycleNotificationRepository,
} from "./service";

const now = Date.UTC(2026, 6, 9, 8);

function notificationCase() {
	return {
		caseId: "case-1",
		deadlineAt: Date.UTC(2026, 6, 11, 8),
		title: "Acute endocrine review"
	};
}

function recipient(overrides: Partial<{
	email: string;
	firstName: string;
	profileId: string;
}> = {}) {
	return {
		email: "student@example.com",
		firstName: "Jordan",
		profileId: "student-1",
		...overrides,
	};
}

function fakeEmailSender(): CaseLifecycleEmailSender {
	return {
		sendNewCasePublishedEmail: vi.fn(async () => {}),
		sendDeadlineReminderEmail: vi.fn(async () => {}),
	};
}

function fakeRepository(
	overrides: Partial<CaseLifecycleNotificationRepository> = {},
): CaseLifecycleNotificationRepository {
	return {
		listCaseLifecycleEmailRecipients: vi.fn(async () => []),
		listCasesReadyForDeadlineReminder: vi.fn(async () => []),
		hasEarnedActiveCaseCertificate: vi.fn(async () => false),
		markDeadlineReminderSent: vi.fn(async () => {}),
		...overrides,
	};
}

describe("case lifecycle notification eligibility", () => {
	it("allows verified students through the active-case product rule boundary", () => {
		expect(
			isEligibleForCaseLifecycleEmail({
				role: "student",
				emailVerifiedAt: 100,
				canAccessCases: true,
			}),
		).toBe(true);
	});

	it("excludes unverified students, blocked students, and teachers", () => {
		expect(
			isEligibleForCaseLifecycleEmail({
				role: "student",
				emailVerifiedAt: 0,
				canAccessCases: true,
			}),
		).toBe(false);
		expect(
			isEligibleForCaseLifecycleEmail({
				role: "student",
				emailVerifiedAt: 100,
				canAccessCases: false,
			}),
		).toBe(false);
		expect(
			isEligibleForCaseLifecycleEmail({
				role: "teacher",
				emailVerifiedAt: 100,
			}),
		).toBe(false);
	});
});

describe("case lifecycle notification service", () => {
	let email: CaseLifecycleEmailSender;

	beforeEach(() => {
		email = fakeEmailSender();
	});

	it("sends new-case emails to selected recipients", async () => {
		const repository = fakeRepository({
			listCaseLifecycleEmailRecipients: vi.fn(async () => [
				recipient(),
				recipient({
					email: "sam@example.com",
					firstName: "Sam",
					profileId: "student-2",
				}),
			]),
		});
		const service = new CaseLifecycleNotificationService(repository, email);

		const result = await service.sendNewCasePublishedEmail(notificationCase());

		expect(result).toEqual({ sent: 2 });
		expect(email.sendNewCasePublishedEmail).toHaveBeenCalledWith({
			to: "student@example.com",
			firstName: "Jordan",
			caseTitle: "Acute endocrine review",
			deadlineAt: Date.UTC(2026, 6, 11, 8),
		});
		expect(email.sendNewCasePublishedEmail).toHaveBeenCalledTimes(2);
	});

	it("sends deadline reminders only to recipients without the active case certificate", async () => {
		const caseRecord = notificationCase();
		const repository = fakeRepository({
			listCasesReadyForDeadlineReminder: vi.fn(async () => [caseRecord]),
			listCaseLifecycleEmailRecipients: vi.fn(async () => [
				recipient(),
				recipient({
					email: "certified@example.com",
					firstName: "Casey",
					profileId: "student-2",
				}),
			]),
			hasEarnedActiveCaseCertificate: vi.fn(async ({ studentProfileId }) =>
				studentProfileId === "student-2"
			),
		});
		const service = new CaseLifecycleNotificationService(repository, email);

		const result = await service.sendDeadlineReminderEmails(now);

		expect(result).toEqual({ casesChecked: 1, failed: 0, sent: 1 });
		expect(email.sendDeadlineReminderEmail).toHaveBeenCalledWith({
			to: "student@example.com",
			firstName: "Jordan",
			caseTitle: "Acute endocrine review",
			deadlineAt: Date.UTC(2026, 6, 11, 8),
		});
		expect(email.sendDeadlineReminderEmail).toHaveBeenCalledTimes(1);
		expect(repository.markDeadlineReminderSent).toHaveBeenCalledWith({
			caseId: "case-1",
			sentAt: now,
		});
	});

	it("marks a reminder case after a recipient delivery failure so successful sends are not retried", async () => {
		const caseRecord = notificationCase();
		const repository = fakeRepository({
			listCasesReadyForDeadlineReminder: vi.fn(async () => [caseRecord]),
			listCaseLifecycleEmailRecipients: vi.fn(async () => [
				recipient(),
				recipient({
					email: "failing@example.com",
					firstName: "Fallon",
					profileId: "student-2",
				}),
			]),
		});
		const service = new CaseLifecycleNotificationService(repository, email);

		vi.mocked(email.sendDeadlineReminderEmail)
			.mockResolvedValueOnce()
			.mockRejectedValueOnce(new Error("email provider unavailable"));

		const result = await service.sendDeadlineReminderEmails(now);

		expect(result).toEqual({ casesChecked: 1, failed: 1, sent: 1 });
		expect(email.sendDeadlineReminderEmail).toHaveBeenCalledTimes(2);
		expect(repository.markDeadlineReminderSent).toHaveBeenCalledWith({
			caseId: "case-1",
			sentAt: now,
		});
	});
});

describe("deadline reminder timing", () => {
	it("matches unsent active cases due within the next 48 hours", () => {
		expect(
			isReadyForDeadlineReminder(
				{ deadlineAt: now + deadlineReminderLeadTimeMs },
				now,
			),
		).toBe(true);
		expect(
			isReadyForDeadlineReminder(
				{ deadlineAt: now + deadlineReminderLeadTimeMs + 1 },
				now,
			),
		).toBe(false);
		expect(
			isReadyForDeadlineReminder(
				{ deadlineAt: now + oneHourMs },
				now,
			),
		).toBe(true);
		expect(
			isReadyForDeadlineReminder(
				{ deadlineAt: now },
				now,
			),
		).toBe(false);
		expect(
			isReadyForDeadlineReminder(
				{ deadlineAt: now - 1 },
				now,
			),
		).toBe(false);
	});

	it("does not match cases that already recorded a reminder", () => {
		expect(
			isReadyForDeadlineReminder(
				{
					deadlineAt: now + deadlineReminderLeadTimeMs,
					deadlineReminderSentAt: now - 1,
				},
				now,
			),
		).toBe(false);
	});
});
