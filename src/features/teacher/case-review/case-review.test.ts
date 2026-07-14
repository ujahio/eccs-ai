import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetE2EAuthStore,
	seedE2EStudentCaseCompletions,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
	requireTeacherSession: vi.fn(async () => ({
		profile: { profileId: "teacher-1" },
	})),
}));

let getTeacherCaseReview: typeof import("./case-review").getTeacherCaseReview;

beforeAll(async () => {
	({ getTeacherCaseReview } = await import("./case-review"));
});

beforeEach(() => {
	process.env.AUTH_E2E_MODE = "memory";
	resetE2EAuthStore();
});

describe("getTeacherCaseReview", () => {
	it("loads active case completions with locked analysis and feedback", async () => {
		const now = Date.UTC(2026, 6, 7, 12);
		seedE2ETeacherCases([
			{
				caseId: "case-1",
				title: "Acute endocrine case review",
				lifecycle: "published",
				publishedAt: now - 1_000,
				deadlineAt: now + 86_400_000,
				teacherProfileId: "teacher-1",
				completionCount: 1,
				feedbackCount: 1,
			},
		]);
		seedE2EStudentCaseCompletions([
			{
				analysisLockedAt: now,
				analysisSubmittedAt: now - 1_000,
				caseId: "case-1",
				certificateId: "certificate-1",
				completedAt: now,
				completionId: "completion-1",
				feedback: {
					ratings: { knowledge: 5 },
					submittedAt: now + 1_000,
				},
				personalAnalysis: "Final student clinical reasoning.",
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
		]);

		const review = await getTeacherCaseReview("case-1");

		expect(review?.caseRecord.title).toBe("Acute endocrine case review");
		expect(review?.completions).toEqual([
			expect.objectContaining({
				feedback: expect.objectContaining({ ratings: { knowledge: 5 } }),
				personalAnalysis: "Final student clinical reasoning.",
				studentDisplayName: "Jordan Adebayo",
			}),
		]);
		expect(review?.completions[0]).not.toHaveProperty("certificateId");
	});

	it("does not expose draft or other-teacher cases", async () => {
		const now = Date.UTC(2026, 6, 7, 12);
		seedE2ETeacherCases([
			{
				caseId: "draft-case",
				title: "Draft case",
				lifecycle: "draft",
				publishedAt: now,
				deadlineAt: now + 86_400_000,
				teacherProfileId: "teacher-1",
				completionCount: 0,
				feedbackCount: 0,
			},
			{
				caseId: "other-teacher-case",
				title: "Other teacher case",
				lifecycle: "published",
				publishedAt: now,
				deadlineAt: now + 86_400_000,
				teacherProfileId: "teacher-2",
				completionCount: 0,
				feedbackCount: 0,
			},
		]);

		await expect(getTeacherCaseReview("draft-case")).resolves.toBeNull();
		await expect(getTeacherCaseReview("other-teacher-case")).resolves.toBeNull();
	});
});
