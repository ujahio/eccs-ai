import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getE2EAuthStore,
	resetE2EAuthStore,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";
import {
	activeCaseArchivePayloadFromEvent,
	DynamoTeacherCaseArchiveRepository,
	InMemoryTeacherCaseArchiveRepository,
	TeacherCaseArchiveService,
} from "./archive-active-case";

const now = Date.UTC(2026, 6, 9, 8);
const oneHourMs = 60 * 60 * 1000;

beforeEach(() => {
	resetE2EAuthStore();
});

describe("TeacherCaseArchiveService", () => {
	it("archives only the scheduled published case at the matching deadline", async () => {
		const deadlineAt = now - 1;
		seedE2ETeacherCases([
			caseRecord({
				caseId: "scheduled-case",
				deadlineAt,
				lifecycle: "published",
			}),
			caseRecord({
				caseId: "other-published-case",
				deadlineAt,
				lifecycle: "published",
			}),
			caseRecord({
				caseId: "same-case-new-deadline",
				deadlineAt: deadlineAt + oneHourMs,
				lifecycle: "published",
			}),
		]);
		const service = new TeacherCaseArchiveService(
			new InMemoryTeacherCaseArchiveRepository(),
		);

		await expect(
			service.archiveActiveCase({
				caseId: "scheduled-case",
				deadlineAt,
			}),
		).resolves.toEqual({
			archived: true,
			caseId: "scheduled-case",
			deadlineAt,
		});
		expect(getE2EAuthStore().teacherCases.get("scheduled-case")).toEqual(
			expect.objectContaining({
				archivedAt: deadlineAt,
				lifecycle: "archived",
			}),
		);
		expect(getE2EAuthStore().teacherCases.get("other-published-case")).toEqual(
			expect.objectContaining({ lifecycle: "published" }),
		);
		expect(getE2EAuthStore().teacherCases.get("same-case-new-deadline")).toEqual(
			expect.objectContaining({ lifecycle: "published" }),
		);
	});

	it("ignores stale schedules for the same case with an old deadline", async () => {
		seedE2ETeacherCases([
			caseRecord({
				caseId: "scheduled-case",
				deadlineAt: now + oneHourMs,
				lifecycle: "published",
			}),
		]);
		const service = new TeacherCaseArchiveService(
			new InMemoryTeacherCaseArchiveRepository(),
		);

		await expect(
			service.archiveActiveCase({
				caseId: "scheduled-case",
				deadlineAt: now - 1,
			}),
		).resolves.toEqual({
			archived: false,
			caseId: "scheduled-case",
			deadlineAt: now - 1,
		});
		expect(getE2EAuthStore().teacherCases.get("scheduled-case")).toEqual(
			expect.objectContaining({ lifecycle: "published" }),
		);
	});
});

describe("DynamoTeacherCaseArchiveRepository", () => {
	it("conditionally archives the exact scheduled case without querying", async () => {
		const sentInputs: Array<Record<string, unknown>> = [];
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sentInputs.push(command.input);

				return {};
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoTeacherCaseArchiveRepository(
			"TeacherCaseTable",
			documentClient,
		);

		await expect(
			repository.markCaseArchived({
				caseId: "scheduled-case",
				deadlineAt: now - 1,
			}),
		).resolves.toBe(true);
		expect(sentInputs).toEqual([
			expect.objectContaining({
				ConditionExpression:
					"attribute_exists(caseId) AND #recordType = :caseRecordType AND #lifecycle = :published AND deadlineAt = :deadlineAt",
				ExpressionAttributeNames: {
					"#lifecycle": "lifecycle",
					"#recordType": "recordType",
				},
				ExpressionAttributeValues: {
					":archived": "archived",
					":caseRecordType": "case",
					":deadlineAt": now - 1,
					":published": "published",
				},
				Key: { caseId: "scheduled-case" },
				UpdateExpression:
					"SET #lifecycle = :archived, archivedAt = :deadlineAt",
			}),
		]);
		expect(documentClient.send).toHaveBeenCalledTimes(1);
	});

	it("treats already-archived races as harmless", async () => {
		const documentClient = {
			send: vi.fn(async () => {
				throw Object.assign(new Error("race"), {
					name: "ConditionalCheckFailedException",
				});
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoTeacherCaseArchiveRepository(
			"TeacherCaseTable",
			documentClient,
		);

		await expect(
			repository.markCaseArchived({
				caseId: "scheduled-case",
				deadlineAt: now - 1,
			}),
		).resolves.toBe(false);
	});
});

describe("activeCaseArchivePayloadFromEvent", () => {
	it("requires the schedule payload shape", () => {
		expect(
			activeCaseArchivePayloadFromEvent({
				caseId: "case-1",
				deadlineAt: now,
			}),
		).toEqual({
			caseId: "case-1",
			deadlineAt: now,
		});

		expect(() => activeCaseArchivePayloadFromEvent({ caseId: "case-1" })).toThrow(
			"Active case archive event is missing caseId or deadlineAt.",
		);
	});
});

function caseRecord({
	archivedAt,
	caseId,
	deadlineAt,
	lifecycle,
}: {
	archivedAt?: number;
	caseId: string;
	deadlineAt: number;
	lifecycle: "published" | "archived" | "draft";
}) {
	return {
		...(typeof archivedAt === "number" ? { archivedAt } : {}),
		caseId,
		completionCount: 0,
		deadlineAt,
		feedbackCount: 0,
		lifecycle,
		publishedAt: now - 2 * oneHourMs,
		recordType: "case" as const,
		title: caseId,
	};
}
