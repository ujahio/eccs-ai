import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { emptyCaseDraft } from "./schema";

vi.mock("server-only", () => ({}));

let DynamoTeacherCaseDraftRepository: typeof import("./drafts").DynamoTeacherCaseDraftRepository;

beforeAll(async () => {
	({ DynamoTeacherCaseDraftRepository } = await import("./drafts"));
});

describe("DynamoTeacherCaseDraftRepository", () => {
	it("saves and loads a teacher draft with a real case id", async () => {
		const sentInputs: Array<Record<string, unknown>> = [];
		let storedRecord: Record<string, unknown> | null = null;
		const draft = {
			...emptyCaseDraft,
			title: "Acute endocrine review",
			description: "A clear student-facing summary.",
			attachments: [
				{
					dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
					id: "attachment-1",
					name: "teaching-resource.pdf",
					size: 1024,
					type: "application/pdf",
					lastModified: 1,
				},
			],
		};
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sentInputs.push(command.input);

				if ("KeyConditionExpression" in command.input) {
					return { Items: storedRecord ? [storedRecord] : [] };
				}

				if ("Item" in command.input) {
					storedRecord = command.input.Item as Record<string, unknown>;
				}

				return {};
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoTeacherCaseDraftRepository(
			"TeacherCaseTable",
			documentClient,
		);

		const savedDraft = await repository.saveDraft({
			draft,
			now: 1_800_000_000,
			teacherProfileId: "teacher-1",
		});
		const loadedDraft = await repository.getDraft("teacher-1");

		expect(savedDraft.title).toBe("Acute endocrine review");
		expect(loadedDraft?.attachments[0]?.dataUrl).toBe(
			"data:application/pdf;base64,JVBERi0xLjQ=",
		);
		expect(sentInputs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					IndexName: "LifecycleDeadlineIndex",
					KeyConditionExpression: "#lifecycle = :draft",
					TableName: "TeacherCaseTable",
				}),
			]),
		);
		const savedInput = sentInputs.find((input) => "Item" in input);
		expect(savedInput?.Item).toEqual(
			expect.objectContaining({
				lifecycle: "draft",
				title: "Acute endocrine review",
				updatedAt: 1_800_000_000,
			}),
		);
		expect(savedInput?.Item).not.toEqual(
			expect.objectContaining({ caseId: expect.stringContaining("draft#") }),
		);
		expect(String((savedInput?.Item as { caseId?: unknown })?.caseId)).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});
});
