import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetE2EAuthStore,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

vi.mock("server-only", () => ({}));

const attachmentSigningSecret = "student-case-test-secret";

const cmeQuestions = [
	{
		id: "question-1",
		prompt: "Which finding best supports diagnosis 1?",
		options: [
			{ id: "q1-a", text: "Correct finding" },
			{ id: "q1-b", text: "Distractor finding" },
		],
		correctOptionId: "q1-a",
	},
	{
		id: "question-2",
		prompt: "Which finding best supports diagnosis 2?",
		options: [
			{ id: "q2-a", text: "Correct management" },
			{ id: "q2-b", text: "Distractor management" },
		],
		correctOptionId: "q2-a",
	},
	{
		id: "question-3",
		prompt: "Which finding best supports diagnosis 3?",
		options: [
			{ id: "q3-a", text: "Correct teaching point" },
			{ id: "q3-b", text: "Distractor teaching point" },
		],
		correctOptionId: "q3-a",
	},
];

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
		attachments: [
			{
				id: "attachment-1",
				name: "teaching-resource.pdf",
				size: 18,
				storageKey: "case-materials/active-case/attachment-1.pdf",
				type: "application/pdf",
				lastModified: 1,
			},
		],
		cmeQuestions,
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
		const now = 2_000;

		await expect(
			repository.getActiveCasePresentation("active-case", now),
		).resolves.toMatchObject({
			caseId: "active-case",
			cmeQuestions: [
				{
					questionId: "question-1",
					prompt: "Which finding best supports diagnosis 1?",
					options: [
						{ optionId: "q1-a", text: "Correct finding" },
						{ optionId: "q1-b", text: "Distractor finding" },
					],
				},
				{
					questionId: "question-2",
					options: [
						{ optionId: "q2-a", text: "Correct management" },
						{ optionId: "q2-b", text: "Distractor management" },
					],
				},
				{
					questionId: "question-3",
					options: [
						{ optionId: "q3-a", text: "Correct teaching point" },
						{ optionId: "q3-b", text: "Distractor teaching point" },
					],
				},
			],
			deadlineAt: 5_000,
			lectureText: "Lecture text placeholder.",
			modelAnswer: "Model answer placeholder.",
			presentation:
				"Patient history, presenting symptoms, laboratory findings, and clinical decision context.",
		});
		const result = await repository.getActiveCasePresentation("active-case", now);
		const attachment = result?.attachments[0];

		expect(attachment).toMatchObject({
			attachmentId: "attachment-1",
			downloadUrl: expect.stringContaining("disposition=attachment"),
			name: "teaching-resource.pdf",
			size: 18,
			type: "application/pdf",
			viewUrl: expect.stringContaining("disposition=inline"),
		});
		expect(attachment?.viewUrl).not.toContain("signature=");
		expect(attachment?.downloadUrl).not.toContain("signature=");
		expect(JSON.stringify(result?.cmeQuestions)).not.toContain("correctOptionId");
	});

	it("creates one certificate only when all quiz answers are correct", async () => {
		const {
			DuplicateStudentCaseCertificateError,
			completeStudentCaseQuiz,
		} = await import("./student-case");
		const previousMode = process.env.AUTH_E2E_MODE;
		process.env.AUTH_E2E_MODE = "memory";
		vi.useFakeTimers();
		vi.setSystemTime(2_000);
		seedE2ETeacherCases([activeCase]);

		try {
			const failedResult = await completeStudentCaseQuiz({
				caseId: "active-case",
				studentProfileId: "student-1",
				studentDisplayName: "Jordan Adebayo",
				answers: {
					"question-1": "q1-b",
					"question-2": "q2-a",
					"question-3": "q3-a",
				},
			});

			expect(failedResult).toEqual({
				failuresSinceReview: 1,
				reviewRequired: false,
				status: "failed",
			});

			const passedResult = await completeStudentCaseQuiz({
				caseId: "active-case",
				studentProfileId: "student-1",
				studentDisplayName: "Jordan Adebayo",
				answers: {
					"question-1": "q1-a",
					"question-2": "q2-a",
					"question-3": "q3-a",
				},
			});

			expect(passedResult).toMatchObject({
				status: "passed",
				certificateId: expect.stringMatching(/^cert_/),
			});
			await expect(
				completeStudentCaseQuiz({
					caseId: "active-case",
					studentProfileId: "student-1",
					studentDisplayName: "Jordan Adebayo",
					answers: {
						"question-1": "q1-a",
						"question-2": "q2-a",
						"question-3": "q3-a",
					},
				}),
			).rejects.toBeInstanceOf(DuplicateStudentCaseCertificateError);
		} finally {
			process.env.AUTH_E2E_MODE = previousMode;
			vi.useRealTimers();
		}
	});

	it("persists the third-failed-attempt review gate until review is completed", async () => {
		const {
			StudentCaseQuizReviewRequiredError,
			completeStudentCaseQuiz,
			completeStudentCaseQuizReview,
		} = await import("./student-case");
		const previousMode = process.env.AUTH_E2E_MODE;
		process.env.AUTH_E2E_MODE = "memory";
		vi.useFakeTimers();
		vi.setSystemTime(2_000);
		seedE2ETeacherCases([activeCase]);

		const incorrectAnswers = {
			"question-1": "q1-b",
			"question-2": "q2-a",
			"question-3": "q3-a",
		};
		const correctAnswers = {
			"question-1": "q1-a",
			"question-2": "q2-a",
			"question-3": "q3-a",
		};
		const args = {
			caseId: "active-case",
			studentProfileId: "student-1",
			studentDisplayName: "Jordan Adebayo",
		};

		try {
			await expect(
				completeStudentCaseQuiz({
					...args,
					answers: incorrectAnswers,
				}),
			).resolves.toMatchObject({
				failuresSinceReview: 1,
				reviewRequired: false,
				status: "failed",
			});
			await expect(
				completeStudentCaseQuiz({
					...args,
					answers: incorrectAnswers,
				}),
			).resolves.toMatchObject({
				failuresSinceReview: 2,
				reviewRequired: false,
				status: "failed",
			});
			await expect(
				completeStudentCaseQuiz({
					...args,
					answers: incorrectAnswers,
				}),
			).resolves.toMatchObject({
				failuresSinceReview: 0,
				reviewRequired: true,
				status: "failed",
			});
			await expect(
				completeStudentCaseQuiz({
					...args,
					answers: correctAnswers,
				}),
			).rejects.toBeInstanceOf(StudentCaseQuizReviewRequiredError);

			await completeStudentCaseQuizReview({
				caseId: "active-case",
				studentProfileId: "student-1",
			});

			await expect(
				completeStudentCaseQuiz({
					...args,
					answers: correctAnswers,
				}),
			).resolves.toMatchObject({
				status: "passed",
				certificateId: expect.stringMatching(/^cert_/),
			});
		} finally {
			process.env.AUTH_E2E_MODE = previousMode;
			vi.useRealTimers();
		}
	});

	it("returns active PDF attachment storage references only before the deadline", async () => {
		const { InMemoryStudentCaseRepository } = await import("./student-case");
		seedE2ETeacherCases([activeCase]);

		const repository = new InMemoryStudentCaseRepository();

		await expect(
			repository.getActiveCaseAttachment("active-case", "attachment-1", 2_000),
		).resolves.toMatchObject({
			contentType: "application/pdf",
			name: "teaching-resource.pdf",
			storageKey: "case-materials/active-case/attachment-1.pdf",
		});
		await expect(
			repository.getActiveCaseAttachment("active-case", "attachment-1", 5_001),
		).resolves.toBeNull();
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

describe("student case attachment signed URLs", () => {
	it("rejects expired or tampered attachment links", async () => {
		const {
			createStudentCaseAttachmentUrl,
			isValidStudentCaseAttachmentUrl,
		} = await import("./student-case");
		const signedUrl = createStudentCaseAttachmentUrl({
			attachmentId: "attachment-1",
			caseId: "active-case",
			disposition: "inline",
			expiresAt: 3_000,
			secret: attachmentSigningSecret,
		});
		const signature = new URL(signedUrl, "http://localhost").searchParams.get(
			"signature",
		);

		expect(
			isValidStudentCaseAttachmentUrl({
				attachmentId: "attachment-1",
				caseId: "active-case",
				disposition: "inline",
				expiresAt: 3_000,
				now: 2_999,
				secret: attachmentSigningSecret,
				signature,
			}),
		).toBe(true);
		expect(
			isValidStudentCaseAttachmentUrl({
				attachmentId: "attachment-1",
				caseId: "active-case",
				disposition: "inline",
				expiresAt: 3_000,
				now: 3_000,
				secret: attachmentSigningSecret,
				signature,
			}),
		).toBe(false);
		expect(
			isValidStudentCaseAttachmentUrl({
				attachmentId: "attachment-2",
				caseId: "active-case",
				disposition: "inline",
				expiresAt: 3_000,
				now: 2_999,
				secret: attachmentSigningSecret,
				signature,
			}),
		).toBe(false);
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
			"StudentCertificateTable",
			"StudentQuizAttemptTable",
			documentClient,
		);

		const presentation = await repository.getActiveCasePresentation(
			"active-case",
			2_000,
		);

		expect(presentation?.caseId).toBe("active-case");
		expect(presentation?.lectureText).toBe("Lecture text placeholder.");
		expect(presentation?.modelAnswer).toBe("Model answer placeholder.");
		expect(presentation?.presentation).toContain("Patient history");
		expect(presentation?.attachments[0]?.downloadUrl).toContain(
			"disposition=attachment",
		);
	});

	it("loads active PDF attachment metadata by id", async () => {
		const { DynamoStudentCaseRepository } = await import("./student-case");
		const documentClient = {
			send: vi.fn(async () => ({ Item: activeCase })),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoStudentCaseRepository(
			"TeacherCaseTable",
			"StudentCertificateTable",
			"StudentQuizAttemptTable",
			documentClient,
		);

		const attachment = await repository.getActiveCaseAttachment(
			"active-case",
			"attachment-1",
			2_000,
		);

		expect(attachment?.contentType).toBe("application/pdf");
		expect(attachment?.name).toBe("teaching-resource.pdf");
		expect(attachment?.storageKey).toBe(
			"case-materials/active-case/attachment-1.pdf",
		);
	});

	it("uses a transactional certificate write with duplicate protection", async () => {
		const { DynamoStudentCaseRepository } = await import("./student-case");
		const documentClient = {
			send: vi.fn(async () => ({})),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoStudentCaseRepository(
			"TeacherCaseTable",
			"StudentCertificateTable",
			"StudentQuizAttemptTable",
			documentClient,
		);

		await repository.createStudentCaseCertificate(
			{
				certificateId: "certificate-1",
				caseId: "active-case",
				caseTitle: "Acute endocrine review",
				completedAt: 2_000,
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			2_000,
		);

		const command = vi.mocked(documentClient.send).mock.calls[0]?.[0] as {
			input?: {
				TransactItems?: Array<{
					Put?: { ConditionExpression?: string };
					Update?: { ConditionExpression?: string };
				}>;
			};
		};

		expect(command.input?.TransactItems?.[0]?.Put?.ConditionExpression).toBe(
			"attribute_not_exists(certificateId)",
		);
		expect(command.input?.TransactItems?.[1]?.Update?.ConditionExpression).toBe(
			"attribute_exists(caseId) AND #lifecycle = :published AND deadlineAt >= :now",
		);
	});

	it("records a failed quiz attempt without updating the attempt primary key", async () => {
		const { DynamoStudentCaseRepository } = await import("./student-case");
		const documentClient = {
			send: vi.fn(async () => ({})),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoStudentCaseRepository(
			"TeacherCaseTable",
			"StudentCertificateTable",
			"StudentQuizAttemptTable",
			documentClient,
		);

		await repository.recordFailedStudentCaseQuizAttempt(
			{
				caseId: "active-case",
				studentProfileId: "student-1",
			},
			2_000,
		);

		const command = vi.mocked(documentClient.send).mock.calls[1]?.[0] as {
			input?: {
				ExpressionAttributeValues?: Record<string, unknown>;
				Key?: { attemptId?: string };
				UpdateExpression?: string;
			};
		};

		expect(command.input?.Key?.attemptId).toEqual(
			expect.stringMatching(/^quiz_attempt_/),
		);
		expect(command.input?.UpdateExpression).not.toContain("attemptId");
		expect(command.input?.ExpressionAttributeValues).not.toHaveProperty(
			":attemptId",
		);
	});
});
