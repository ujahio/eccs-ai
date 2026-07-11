import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { emptyCaseDraft, type CaseDraft } from "./schema";
import type { TeacherCaseDraftRecord } from "./drafts";

vi.mock("server-only", () => ({}));

const storageMocks = vi.hoisted(() => ({
	cleanupUploadedAttachments: vi.fn(),
	deleteStoredAttachments: vi.fn(),
	storeDraftAttachments: vi.fn(
		async ({ attachments }: { attachments: CaseDraft["attachments"] }) => ({
			attachments: attachments.map((attachment) => ({
				id: attachment.id,
				name: attachment.name,
				size: attachment.size,
				storageKey: attachment.storageKey ?? `stored/${attachment.id}.pdf`,
				type: attachment.type,
				lastModified: attachment.lastModified,
			})),
			uploadedStorageKeys: attachments.flatMap((attachment) =>
				attachment.storageKey ? [] : [`stored/${attachment.id}.pdf`],
			),
		}),
	),
}));

vi.mock("@/features/case-materials/storage", () => storageMocks);

let DynamoTeacherCaseDraftRepository: typeof import("./drafts").DynamoTeacherCaseDraftRepository;

beforeAll(async () => {
	({ DynamoTeacherCaseDraftRepository } = await import("./drafts"));
});

describe("DynamoTeacherCaseDraftRepository", () => {
	it("creates a case id and preserves it when updating that draft", async () => {
		const { documentClient, records } = createDocumentClient();
		const repository = new DynamoTeacherCaseDraftRepository(
			"TeacherCaseTable",
			documentClient,
		);

		const savedDraft = await repository.saveDraft({
			draft: draftWithAttachment("Acute endocrine review"),
			now: 1_800_000_000,
			teacherProfileId: "teacher-1",
		});
		const caseId = savedDraft?.caseId ?? "";
		const updatedDraft = await repository.saveDraft({
			caseId,
			draft: draftWithAttachment("Updated endocrine review"),
			now: 1_800_000_100,
			teacherProfileId: "teacher-1",
		});
		const listedDrafts = await repository.listDrafts("teacher-1");
		const loadedDraft = await repository.getDraft("teacher-1", caseId);

		expect(caseId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(updatedDraft).toEqual(
			expect.objectContaining({
				caseId,
				title: "Updated endocrine review",
			}),
		);
		expect(records.size).toBe(1);
		expect(loadedDraft?.caseId).toBe(caseId);
		expect(loadedDraft?.title).toBe("Updated endocrine review");
		expect(loadedDraft?.attachments[0]?.storageKey).toBe(
			"stored/attachment-1.pdf",
		);
		expect(loadedDraft?.attachments[0]?.dataUrl).toBeUndefined();
		expect(listedDrafts).toEqual([
			{
				attachmentCount: 1,
				caseId,
				deadlineDate: "",
				description: "A clear student-facing summary.",
				title: "Updated endocrine review",
				updatedAt: 1_800_000_100,
			},
		]);
		expect(records.get(caseId)).toEqual(
			expect.objectContaining({
				caseId,
				draft: expect.objectContaining({
					attachments: [
						expect.objectContaining({
							id: "attachment-1",
							storageKey: "stored/attachment-1.pdf",
						}),
					],
				}),
				lifecycle: "draft",
				recordType: "case",
				title: "Updated endocrine review",
				updatedAt: 1_800_000_100,
			}),
		);
	});

	it("deletes a specific draft and reports removed attachment data", async () => {
		const draft = {
			...draftWithAttachment("Acute endocrine review"),
			attachments: [
				{
					id: "attachment-1",
					name: "teaching-resource.pdf",
					size: 1024,
					storageKey: "stored/attachment-1.pdf",
					type: "application/pdf",
					lastModified: 1,
				},
			],
		};
		const { documentClient, records } = createDocumentClient(
			new Map([
				[
					"case-1",
					recordForDraft({
						caseId: "case-1",
						draft,
						teacherProfileId: "teacher-1",
						updatedAt: 1_800_000_000,
					}),
				],
			]),
		);
		const repository = new DynamoTeacherCaseDraftRepository(
			"TeacherCaseTable",
			documentClient,
		);

		const result = await repository.deleteDraft({
			caseId: "case-1",
			teacherProfileId: "teacher-1",
		});
		const loadedDraft = await repository.getDraft("teacher-1", "case-1");

		expect(result).toEqual({ attachmentCount: 1, caseId: "case-1" });
		expect(records.has("case-1")).toBe(false);
		expect(loadedDraft).toBeNull();
		expect(storageMocks.deleteStoredAttachments).toHaveBeenCalledWith({
			attachments: draft.attachments,
		});
	});
});

function createDocumentClient(
	records = new Map<string, TeacherCaseDraftRecord>(),
) {
	const sentInputs: Array<Record<string, unknown>> = [];
	const documentClient = {
		send: vi.fn(
			async (command: {
				constructor: { name: string };
				input: Record<string, unknown>;
			}) => {
				sentInputs.push(command.input);

				if (command.constructor.name === "QueryCommand") {
					return { Items: Array.from(records.values()) };
				}

				if (command.constructor.name === "GetCommand") {
					const key = command.input.Key as { caseId: string };

					return { Item: records.get(key.caseId) };
				}

				if (command.constructor.name === "PutCommand") {
					const record = command.input.Item as TeacherCaseDraftRecord;

					records.set(record.caseId, record);
				}

				if (command.constructor.name === "DeleteCommand") {
					const key = command.input.Key as { caseId: string };

					records.delete(key.caseId);
				}

				return {};
			},
		),
	} as unknown as DynamoDBDocumentClient;

	return { documentClient, records, sentInputs };
}

function draftWithAttachment(title: string): CaseDraft {
	return {
		...emptyCaseDraft,
		title,
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
}

function recordForDraft({
	caseId,
	draft,
	teacherProfileId,
	updatedAt,
}: {
	caseId: string;
	draft: CaseDraft;
	teacherProfileId: string;
	updatedAt: number;
}): TeacherCaseDraftRecord {
	return {
		caseId,
		completionCount: 0,
		deadlineAt: 0,
		draft,
		feedbackCount: 0,
		lifecycle: "draft",
		publishedAt: 0,
		recordType: "case",
		teacherProfileId,
		title: draft.title,
		updatedAt,
	};
}
