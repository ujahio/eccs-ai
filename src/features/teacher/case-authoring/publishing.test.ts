import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	getE2ETeacherCaseDraftRecord,
	getE2ETeacherCaseStore,
	resetE2EAuthStore,
	saveE2ETeacherCaseDraftRecord,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";
import { createEmptyCmeQuestion, emptyCaseDraft, type CaseDraft } from "./schema";
import {
	ActivePublishedCaseError,
	DynamoTeacherCasePublisher,
	InMemoryTeacherCasePublisher,
	PublishDraftNotFoundError,
	PublishValidationError,
} from "./publishing";

vi.mock("server-only", () => ({}));
vi.mock("sst", () => ({ Resource: {} }));

const teacherProfileId = "teacher-1";

function validQuestion(index: number) {
	const question = createEmptyCmeQuestion();

	return {
		...question,
		prompt: `Which finding best supports diagnosis ${index}?`,
		options: [
			{ id: `a-${index}`, text: "First option" },
			{ id: `b-${index}`, text: "Second option" },
		],
		correctOptionId: `a-${index}`,
	};
}

function validDraft(): CaseDraft {
	return {
		...emptyCaseDraft,
		title: "Acute endocrine case review",
		description:
			"A focused student-facing description of the clinical learning goals.",
		presentation:
			"Patient history, presenting symptoms, laboratory findings, and the clinical decision context are described with enough detail for learners to reason carefully.",
		modelAnswer:
			"The model answer explains the diagnostic path, key discriminating findings, management priorities, and teaching points for comparison.",
		lectureText:
			"Case Study resources summarize the core physiology, common diagnostic pitfalls, and next-step management considerations for review.",
		cmeQuestions: [validQuestion(1), validQuestion(2), validQuestion(3)],
		deadlineDate: "2026-08-12",
	};
}

describe("InMemoryTeacherCasePublisher", () => {
	beforeEach(() => {
		resetE2EAuthStore();
	});

	it("publishes a complete draft as an immutable active case snapshot", async () => {
		const now = Date.UTC(2026, 6, 7);
		const draft = validDraft();
		saveE2ETeacherCaseDraftRecord({
			caseId: "draft-case",
			draft,
			teacherProfileId,
			title: draft.title,
			updatedAt: now - 1,
		});
		const publisher = new InMemoryTeacherCasePublisher();

		const publishedCase = await publisher.publishDraft({
			caseId: "draft-case",
			draft,
			now,
			teacherProfileId,
		});

		expect(publishedCase).toMatchObject({
			caseId: "draft-case",
			deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
			lifecycle: "published",
			publishedAt: now,
			title: draft.title,
		});
		expect(getE2ETeacherCaseStore()).toEqual([
			expect.objectContaining({
				caseId: "draft-case",
				lifecycle: "published",
			}),
		]);
		expect(
			getE2ETeacherCaseDraftRecord(teacherProfileId, "draft-case"),
		).toBeNull();
	});

	it("rejects incomplete publish content", async () => {
		const publisher = new InMemoryTeacherCasePublisher();

		await expect(
			publisher.publishDraft({
				draft: emptyCaseDraft,
				now: Date.UTC(2026, 6, 7),
				teacherProfileId,
			}),
		).rejects.toBeInstanceOf(PublishValidationError);
	});

	it("rejects a deadline date that has already passed", async () => {
		const publisher = new InMemoryTeacherCasePublisher();

		await expect(
			publisher.publishDraft({
				draft: {
					...validDraft(),
					deadlineDate: "2026-07-06",
				},
				now: Date.UTC(2026, 6, 7),
				teacherProfileId,
			}),
		).rejects.toMatchObject({
			validation: {
				deadlineDate: "Select a deadline date that has not passed.",
			},
		});
	});

	it("blocks publishing while another published case is still active", async () => {
		const now = Date.UTC(2026, 6, 7);
		seedE2ETeacherCases([
			{
				caseId: "active-case",
				title: "Active case",
				lifecycle: "published",
				publishedAt: now - 1_000,
				deadlineAt: now + 86_400_000,
				completionCount: 0,
				feedbackCount: 0,
			},
		]);
		const publisher = new InMemoryTeacherCasePublisher();

		await expect(
			publisher.publishDraft({
				draft: validDraft(),
				now,
				teacherProfileId,
			}),
		).rejects.toBeInstanceOf(ActivePublishedCaseError);
	});

	it("allows publishing after the previous published case deadline has passed", async () => {
		const now = Date.UTC(2026, 6, 7);
		seedE2ETeacherCases([
			{
				caseId: "expired-case",
				title: "Expired case",
				lifecycle: "published",
				publishedAt: now - 172_800_000,
				deadlineAt: now - 1,
				completionCount: 0,
				feedbackCount: 0,
			},
		]);
		const publisher = new InMemoryTeacherCasePublisher();

		const publishedCase = await publisher.publishDraft({
			draft: validDraft(),
			now,
			teacherProfileId,
		});

		expect(publishedCase.lifecycle).toBe("published");
		expect(getE2ETeacherCaseStore()).toHaveLength(2);
	});

	it("does not publish over a missing draft id", async () => {
		const publisher = new InMemoryTeacherCasePublisher();

		await expect(
			publisher.publishDraft({
				caseId: "missing-draft",
				draft: validDraft(),
				now: Date.UTC(2026, 6, 7),
				teacherProfileId,
			}),
		).rejects.toBeInstanceOf(PublishDraftNotFoundError);
	});
});

describe("DynamoTeacherCasePublisher", () => {
	it("uses a transactional active-case lock when publishing", async () => {
		const now = Date.UTC(2026, 6, 7);
		const sentInputs: Array<Record<string, unknown>> = [];
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sentInputs.push(command.input);

				if (command.input.KeyConditionExpression) {
					return { Items: [] };
				}

				return {};
			}),
		} as unknown as DynamoDBDocumentClient;
		const publisher = new DynamoTeacherCasePublisher(
			"TeacherCaseTable",
			documentClient,
		);

		await publisher.publishDraft({
			draft: validDraft(),
			now,
			teacherProfileId,
		});

		const transaction = sentInputs.find((input) => input.TransactItems);
		expect(transaction).toMatchObject({
			TransactItems: [
				{
					Put: {
						Item: {
							caseId: "teacher-case-active-lock",
							lifecycle: "activeCaseLock",
						},
						ConditionExpression:
							"attribute_not_exists(caseId) OR deadlineAt < :now",
					},
				},
				{
					Put: {
						Item: expect.objectContaining({
							lifecycle: "published",
							title: "Acute endocrine case review",
						}),
						ConditionExpression: "attribute_not_exists(caseId)",
					},
				},
			],
		});
	});

	it("maps transaction lock conflicts to an active-case publish conflict", async () => {
		const now = Date.UTC(2026, 6, 7);
		const activeCase = {
			caseId: "active-case",
			title: "Active case",
			lifecycle: "published" as const,
			publishedAt: now - 1_000,
			deadlineAt: now + 86_400_000,
			completionCount: 0,
			feedbackCount: 0,
		};
		let activeQueryCount = 0;
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				if (command.input.KeyConditionExpression) {
					activeQueryCount += 1;

					return { Items: activeQueryCount === 1 ? [] : [activeCase] };
				}

				throw {
					name: "TransactionCanceledException",
					CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
				};
			}),
		} as unknown as DynamoDBDocumentClient;
		const publisher = new DynamoTeacherCasePublisher(
			"TeacherCaseTable",
			documentClient,
		);

		await expect(
			publisher.publishDraft({
				draft: validDraft(),
				now,
				teacherProfileId,
			}),
		).rejects.toBeInstanceOf(ActivePublishedCaseError);
	});
});
