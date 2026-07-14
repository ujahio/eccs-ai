import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetE2EAuthStore,
	seedE2EStudentCaseCompletions,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

vi.mock("server-only", () => ({}));

let InMemoryTeacherCaseLibraryRepository: typeof import("./cases").InMemoryTeacherCaseLibraryRepository;

beforeAll(async () => {
	({ InMemoryTeacherCaseLibraryRepository } = await import("./cases"));
});

beforeEach(() => {
	resetE2EAuthStore();
});

describe("InMemoryTeacherCaseLibraryRepository", () => {
	it("lists archived and dynamically expired cases from newest to oldest", async () => {
		const now = Date.UTC(2026, 6, 7);
		seedE2ETeacherCases([
			{
				caseId: "active-case",
				title: "Active case",
				lifecycle: "published",
				publishedAt: now - 1_000,
				deadlineAt: now + 86_400_000,
				completionCount: 2,
				feedbackCount: 1,
			},
			{
				caseId: "archived-older",
				title: "Archived older",
				lifecycle: "archived",
				publishedAt: now - 259_200_000,
				deadlineAt: now - 172_800_000,
				archivedAt: now - 172_800_000,
				completionCount: 5,
				feedbackCount: 2,
			},
			{
				caseId: "expired-published",
				title: "Expired published",
				lifecycle: "published",
				publishedAt: now - 86_400_000,
				deadlineAt: now - 1_000,
				completionCount: 7,
				feedbackCount: 3,
			},
			{
				caseId: "archived-newer",
				title: "Archived newer",
				lifecycle: "archived",
				publishedAt: now - 172_800_000,
				deadlineAt: now - 86_400_000,
				archivedAt: now - 500,
				completionCount: 9,
				feedbackCount: 4,
			},
		]);
		seedE2EStudentCaseCompletions([
			{
				analysisLockedAt: now,
				analysisSubmittedAt: now,
				caseId: "archived-newer",
				certificateId: "certificate-1",
				completedAt: now,
				completionId: "completion-1",
				feedback: { submittedAt: now },
				personalAnalysis: "Analysis one.",
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			{
				analysisLockedAt: now,
				analysisSubmittedAt: now,
				caseId: "archived-newer",
				certificateId: "certificate-2",
				completedAt: now - 1,
				completionId: "completion-2",
				personalAnalysis: "Analysis two.",
				studentDisplayName: "Morgan Lee",
				studentProfileId: "student-2",
			},
			{
				analysisLockedAt: now,
				analysisSubmittedAt: now,
				caseId: "expired-published",
				certificateId: "certificate-3",
				completedAt: now - 2,
				completionId: "completion-3",
				personalAnalysis: "Analysis three.",
				studentDisplayName: "Riley Chen",
				studentProfileId: "student-3",
			},
		]);
		const repository = new InMemoryTeacherCaseLibraryRepository();

		const archivedCases = await repository.listArchivedCases(now);

		expect(archivedCases.map((caseRecord) => caseRecord.caseId)).toEqual([
			"archived-newer",
			"expired-published",
			"archived-older",
		]);
		expect(archivedCases).toEqual([
			expect.objectContaining({
				caseId: "archived-newer",
				completionCount: 2,
				feedbackCount: 1,
			}),
			expect.objectContaining({
				caseId: "expired-published",
				completionCount: 1,
				feedbackCount: 0,
			}),
			expect.objectContaining({
				caseId: "archived-older",
				completionCount: 0,
				feedbackCount: 0,
			}),
		]);
		expect(archivedCases).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ caseId: "active-case" }),
			]),
		);
	});
});
