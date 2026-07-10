import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	bootstrapE2EStudent,
	bootstrapE2ETeacher,
	getE2EAuthStore,
	resetE2EAuthStore,
	seedE2EStudentCertificates,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";
import { deadlineReminderLeadTimeMs, oneHourMs } from "./service";
import {
	DynamoCaseLifecycleNotificationRepository,
	InMemoryCaseLifecycleNotificationRepository,
} from "./repository";

vi.mock("server-only", () => ({}));

const now = Date.UTC(2026, 6, 9, 8);

describe("InMemoryCaseLifecycleNotificationRepository", () => {
	beforeEach(() => {
		resetE2EAuthStore();
	});

	it("selects verified student recipients through the active-case eligibility rule", async () => {
		const eligible = bootstrapE2EStudent({
			email: "eligible@example.com",
			firstName: "Jordan",
			lastName: "Rivera",
			password: "password-123",
		});
		bootstrapE2EStudent({
			email: "unverified@example.com",
			firstName: "Unverified",
			lastName: "Student",
			password: "password-123",
			emailVerified: false,
		});
		const blocked = bootstrapE2EStudent({
			email: "blocked@example.com",
			firstName: "Blocked",
			lastName: "Student",
			password: "password-123",
		});
		bootstrapE2ETeacher({
			email: "teacher@example.com",
			firstName: "Taylor",
			lastName: "Teacher",
			temporaryPassword: "password-123",
		});
		const blockedProfile = getE2EAuthStore().profiles.get(
			blocked.emailNormalized,
		);

		if (blockedProfile?.role === "student") {
			getE2EAuthStore().profiles.set(blocked.emailNormalized, {
				...blockedProfile,
				canAccessCases: false,
			});
		}

		const repository = new InMemoryCaseLifecycleNotificationRepository();

		await expect(repository.listCaseLifecycleEmailRecipients()).resolves.toEqual([
			{
				email: eligible.emailNormalized,
				firstName: "Jordan",
				profileId: eligible.profileId,
			},
		]);
	});

	it("selects unsent active published cases due within the next 48 hours", async () => {
		seedE2ETeacherCases([
			{
				caseId: "at-threshold",
				title: "At threshold",
				lifecycle: "published",
				publishedAt: now - 1,
				deadlineAt: now + deadlineReminderLeadTimeMs,
				completionCount: 0,
				feedbackCount: 0,
			},
			{
				caseId: "catch-up",
				title: "Catch up",
				lifecycle: "published",
				publishedAt: now - 1,
				deadlineAt: now + oneHourMs,
				completionCount: 0,
				feedbackCount: 0,
			},
			{
				caseId: "too-early",
				title: "Too early",
				lifecycle: "published",
				publishedAt: now - 1,
				deadlineAt: now + deadlineReminderLeadTimeMs + 1,
				completionCount: 0,
				feedbackCount: 0,
			},
			{
				caseId: "expired",
				title: "Expired",
				lifecycle: "published",
				publishedAt: now - 1,
				deadlineAt: now,
				completionCount: 0,
				feedbackCount: 0,
			},
			{
				caseId: "already-sent",
				title: "Already sent",
				lifecycle: "published",
				publishedAt: now - 1,
				deadlineAt: now + deadlineReminderLeadTimeMs,
				deadlineReminderSentAt: now - 1000,
				completionCount: 0,
				feedbackCount: 0,
			},
		]);
		const repository = new InMemoryCaseLifecycleNotificationRepository();

		await expect(
			repository.listCasesReadyForDeadlineReminder(now),
		).resolves.toEqual([
			{
				caseId: "at-threshold",
				deadlineAt: now + deadlineReminderLeadTimeMs,
				title: "At threshold",
			},
			{
				caseId: "catch-up",
				deadlineAt: now + oneHourMs,
				title: "Catch up",
			},
		]);
	});

	it("checks whether a student has earned the active case certificate", async () => {
		seedE2EStudentCertificates([
			{
				certificateId: "certificate-1",
				caseId: "case-1",
				caseTitle: "Acute endocrine review",
				completedAt: now,
				studentDisplayName: "Jordan Rivera",
				studentProfileId: "student-1",
			},
		]);
		const repository = new InMemoryCaseLifecycleNotificationRepository();

		await expect(
			repository.hasEarnedActiveCaseCertificate({
				caseId: "case-1",
				studentProfileId: "student-1",
			}),
		).resolves.toBe(true);
		await expect(
			repository.hasEarnedActiveCaseCertificate({
				caseId: "case-2",
				studentProfileId: "student-1",
			}),
		).resolves.toBe(false);
	});
});

describe("DynamoCaseLifecycleNotificationRepository", () => {
	it("queries active cases from now through the 48-hour reminder threshold", async () => {
		const sentInputs: Array<Record<string, unknown>> = [];
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sentInputs.push(command.input);

				return {
					Items: [
						{
							caseId: "expires-now",
							deadlineAt: now,
							lifecycle: "published",
							recordType: "case",
							title: "Expires now",
						},
						{
							caseId: "catch-up",
							deadlineAt: now + oneHourMs,
							lifecycle: "published",
							recordType: "case",
							title: "Catch up",
						},
					],
				};
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoCaseLifecycleNotificationRepository(
			"UserProfileTable",
			"TeacherCaseTable",
			"StudentCertificateTable",
			documentClient,
		);

		await expect(
			repository.listCasesReadyForDeadlineReminder(now),
		).resolves.toEqual([
			{
				caseId: "catch-up",
				deadlineAt: now + oneHourMs,
				title: "Catch up",
			},
		]);
		expect(sentInputs).toEqual([
			expect.objectContaining({
				ExpressionAttributeValues: {
					":now": now,
					":published": "published",
					":thresholdAt": now + deadlineReminderLeadTimeMs,
				},
				KeyConditionExpression:
					"#lifecycle = :published AND deadlineAt BETWEEN :now AND :thresholdAt",
			}),
		]);
	});
});
