import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { emptyCaseDraft } from "./schema";

vi.mock("server-only", () => ({}));

let DynamoTeacherCaseDraftRepository: typeof import("./drafts").DynamoTeacherCaseDraftRepository;
let teacherDraftCaseId: typeof import("./drafts").teacherDraftCaseId;

beforeAll(async () => {
	({ DynamoTeacherCaseDraftRepository, teacherDraftCaseId } = await import(
		"./drafts"
	));
});

describe("DynamoTeacherCaseDraftRepository", () => {
	it("saves and loads a teacher draft from the teacher case table", async () => {
		const sentInputs: Array<Record<string, unknown>> = [];
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

				if ("Key" in command.input) {
					return {
						Item: {
							caseId: teacherDraftCaseId("teacher-1"),
							draft,
							lifecycle: "draft",
						},
					};
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
					Item: expect.objectContaining({
						caseId: "draft#teacher-1",
						lifecycle: "draft",
						title: "Acute endocrine review",
						updatedAt: 1_800_000_000,
					}),
				}),
				expect.objectContaining({
					Key: { caseId: "draft#teacher-1" },
					TableName: "TeacherCaseTable",
				}),
			]),
		);
	});
});
