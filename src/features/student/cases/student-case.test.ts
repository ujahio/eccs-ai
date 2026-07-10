import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetE2EAuthStore,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

vi.mock("server-only", () => ({}));

const activeCase = {
	caseId: "active-case",
	title: "Acute endocrine review",
	description: "A focused case description for dashboard and case flow.",
	lifecycle: "published" as const,
	publishedAt: 1_000,
	deadlineAt: 5_000,
	completionCount: 0,
	feedbackCount: 0,
	draft: {
		title: "Acute endocrine review",
		description: "Draft case description for learners.",
		presentation:
			"Patient history, presenting symptoms, laboratory findings, and clinical decision context.",
		modelAnswer: "Model answer placeholder.",
		lectureText: "Lecture text placeholder.",
		attachments: [],
		cmeQuestions: [],
		deadlineDate: "2026-07-31",
	},
};

describe("InMemoryStudentCaseRepository", () => {
	beforeEach(() => {
		resetE2EAuthStore();
	});

	it("returns active case presentation content", async () => {
		const { InMemoryStudentCaseRepository } = await import("./student-case");
		seedE2ETeacherCases([activeCase]);

		const repository = new InMemoryStudentCaseRepository();

		await expect(
			repository.getActiveCasePresentation("active-case", 2_000),
		).resolves.toEqual({
			caseId: "active-case",
			deadlineAt: 5_000,
			modelAnswer: "Model answer placeholder.",
			presentation:
				"Patient history, presenting symptoms, laboratory findings, and clinical decision context.",
		});
	});

	it("blocks expired case presentation access", async () => {
		const { InMemoryStudentCaseRepository } = await import("./student-case");
		seedE2ETeacherCases([activeCase]);

		const repository = new InMemoryStudentCaseRepository();

		await expect(
			repository.getActiveCasePresentation("active-case", 5_001),
		).resolves.toBeNull();
	});
});

describe("DynamoStudentCaseRepository", () => {
	it("loads active published case content by id", async () => {
		const { DynamoStudentCaseRepository } = await import("./student-case");
		const documentClient = {
			send: vi.fn(async () => ({ Item: activeCase })),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoStudentCaseRepository(
			"TeacherCaseTable",
			documentClient,
		);

		const presentation = await repository.getActiveCasePresentation(
			"active-case",
			2_000,
		);

		expect(presentation?.caseId).toBe("active-case");
		expect(presentation?.modelAnswer).toBe("Model answer placeholder.");
		expect(presentation?.presentation).toContain("Patient history");
	});
});
