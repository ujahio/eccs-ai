import "server-only";

import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	QueryCommand,
	TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	deleteE2ETeacherCaseDraftRecord,
	getE2ETeacherCaseDraftRecord,
	getE2ETeacherCaseStore,
	isE2EMode,
	saveE2ETeacherCaseRecord,
} from "@/lib/e2e/in-memory-auth";
import {
	deadlineAtFromDubaiDate,
	draftForStorage,
	validateDraftForPublish,
	type CaseDraft,
	type CaseDraftValidation,
} from "./schema";

export type PublishedTeacherCaseRecord = {
	caseId: string;
	completionCount: number;
	deadlineAt: number;
	draft: CaseDraft;
	feedbackCount: number;
	lifecycle: "published";
	publishedAt: number;
	teacherProfileId: string;
	title: string;
};

type StoredTeacherCaseRecord = Omit<PublishedTeacherCaseRecord, "lifecycle"> & {
	archivedAt?: number;
	lifecycle: "published" | "archived" | "draft";
};

export class PublishValidationError extends Error {
	constructor(readonly validation: CaseDraftValidation) {
		super("Draft is not ready to publish.");
	}
}

export class ActivePublishedCaseError extends Error {
	constructor() {
		super("Another published case is still active.");
	}
}

export class PublishDraftNotFoundError extends Error {
	constructor() {
		super("Draft not found.");
	}
}

export interface TeacherCasePublisher {
	publishDraft(args: {
		caseId?: string;
		draft: CaseDraft;
		now: number;
		teacherProfileId: string;
	}): Promise<PublishedTeacherCaseRecord>;
}

export function getTeacherCasePublisher(): TeacherCasePublisher {
	return isE2EMode()
		? new InMemoryTeacherCasePublisher()
		: new DynamoTeacherCasePublisher(
				getSessionAuthResources().teacherCaseTableName,
			);
}

export class InMemoryTeacherCasePublisher implements TeacherCasePublisher {
	async publishDraft({
		caseId,
		draft,
		now,
		teacherProfileId,
	}: {
		caseId?: string;
		draft: CaseDraft;
		now: number;
		teacherProfileId: string;
	}) {
		const validation = validateDraftForPublishAt(draft, now);
		const deadlineAt = deadlineAtFromDubaiDate(draft.deadlineDate);

		if (Object.keys(validation).length > 0 || deadlineAt === null) {
			throw new PublishValidationError(validation);
		}

		if (hasActivePublishedCase(getE2ETeacherCaseStore(), now)) {
			throw new ActivePublishedCaseError();
		}

		const existingDraft = caseId
			? getE2ETeacherCaseDraftRecord(teacherProfileId, caseId)
			: null;

		if (caseId && !existingDraft) {
			throw new PublishDraftNotFoundError();
		}

		const record = publishedCaseRecord({
			caseId: existingDraft?.caseId ?? caseId ?? createTeacherCaseId(),
			draft,
			now,
			deadlineAt,
			teacherProfileId,
		});

		saveE2ETeacherCaseRecord(record);

		if (existingDraft) {
			deleteE2ETeacherCaseDraftRecord(teacherProfileId, existingDraft.caseId);
		}

		return record;
	}
}

export class DynamoTeacherCasePublisher implements TeacherCasePublisher {
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly tableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async publishDraft({
		caseId,
		draft,
		now,
		teacherProfileId,
	}: {
		caseId?: string;
		draft: CaseDraft;
		now: number;
		teacherProfileId: string;
	}) {
		const validation = validateDraftForPublishAt(draft, now);
		const deadlineAt = deadlineAtFromDubaiDate(draft.deadlineDate);

		if (Object.keys(validation).length > 0 || deadlineAt === null) {
			throw new PublishValidationError(validation);
		}

		const [activeCase, existingDraft] = await Promise.all([
			this.getActivePublishedCase(now),
			caseId
				? this.getDraftRecordByCaseId(teacherProfileId, caseId)
				: Promise.resolve(null),
		]);

		if (activeCase) {
			throw new ActivePublishedCaseError();
		}

		if (caseId && !existingDraft) {
			throw new PublishDraftNotFoundError();
		}

		const record = publishedCaseRecord({
			caseId: existingDraft?.caseId ?? caseId ?? createTeacherCaseId(),
			draft,
			now,
			deadlineAt,
			teacherProfileId,
		});

		try {
			await this.documentClient.send(
				new TransactWriteCommand({
					TransactItems: [
						{
							Put: {
								TableName: this.tableName,
								Item: activeCaseLockRecord(record, now),
								ConditionExpression:
									"attribute_not_exists(caseId) OR deadlineAt < :now",
								ExpressionAttributeValues: {
									":now": now,
								},
							},
						},
						{
							Put: existingDraft
								? {
										TableName: this.tableName,
										Item: record,
										ConditionExpression:
											"#lifecycle = :draft AND #teacherProfileId = :teacherProfileId",
										ExpressionAttributeNames: {
											"#lifecycle": "lifecycle",
											"#teacherProfileId": "teacherProfileId",
										},
										ExpressionAttributeValues: {
											":draft": "draft",
											":teacherProfileId": teacherProfileId,
										},
									}
								: {
										TableName: this.tableName,
										Item: record,
										ConditionExpression: "attribute_not_exists(caseId)",
									},
						},
					],
				}),
			);
		} catch (error) {
			if (isConditionalCheckFailed(error)) {
				if (await this.getActivePublishedCase(now)) {
					throw new ActivePublishedCaseError();
				}

				throw new PublishDraftNotFoundError();
			}

			throw error;
		}

		return record;
	}

	private async getActivePublishedCase(now: number) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.tableName,
				IndexName: "LifecycleDeadlineIndex",
				KeyConditionExpression: "#lifecycle = :published AND deadlineAt >= :now",
				ExpressionAttributeNames: {
					"#lifecycle": "lifecycle",
				},
				ExpressionAttributeValues: {
					":published": "published",
					":now": now,
				},
				Limit: 1,
			}),
		);

		return ((response.Items ?? [])[0] as StoredTeacherCaseRecord | undefined) ??
			null;
	}

	private async getDraftRecordByCaseId(
		teacherProfileId: string,
		caseId: string,
	) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.tableName,
				Key: { caseId },
			}),
		);
		const record = response.Item as StoredTeacherCaseRecord | undefined;

		if (
			!record ||
			record.lifecycle !== "draft" ||
			record.teacherProfileId !== teacherProfileId
		) {
			return null;
		}

		return record;
	}
}

function hasActivePublishedCase(
	cases: Parameters<typeof isActiveTeacherCase>[0][],
	now: number,
) {
	return cases.some((caseRecord) => isActiveTeacherCase(caseRecord, now));
}

function publishedCaseRecord({
	caseId,
	deadlineAt,
	draft,
	now,
	teacherProfileId,
}: {
	caseId: string;
	deadlineAt: number;
	draft: CaseDraft;
	now: number;
	teacherProfileId: string;
}): PublishedTeacherCaseRecord {
	const storedDraft = draftForStorage(draft);

	return {
		caseId,
		completionCount: 0,
		deadlineAt,
		draft: storedDraft,
		feedbackCount: 0,
		lifecycle: "published",
		publishedAt: now,
		teacherProfileId,
		title: storedDraft.title.trim(),
	};
}

function validateDraftForPublishAt(draft: CaseDraft, now: number) {
	const validation = validateDraftForPublish(draft);
	const deadlineAt = deadlineAtFromDubaiDate(draft.deadlineDate);

	if (deadlineAt !== null && deadlineAt < now) {
		validation.deadlineDate = "Select a deadline date that has not passed.";
	}

	return validation;
}

function createTeacherCaseId() {
	return randomUUID();
}

function activeCaseLockRecord(
	record: PublishedTeacherCaseRecord,
	now: number,
) {
	return {
		caseId: "teacher-case-active-lock",
		deadlineAt: record.deadlineAt,
		lifecycle: "activeCaseLock",
		publishedCaseId: record.caseId,
		updatedAt: now,
	};
}

function isConditionalCheckFailed(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const errorName =
		"name" in error && typeof error.name === "string" ? error.name : null;

	if (errorName === "ConditionalCheckFailedException") {
		return true;
	}

	if (errorName !== "TransactionCanceledException") {
		return false;
	}

	if (!("CancellationReasons" in error)) {
		return true;
	}

	const reasons = error.CancellationReasons;

	return (
		Array.isArray(reasons) &&
		reasons.some(
			(reason) =>
				typeof reason === "object" &&
				reason !== null &&
				"Code" in reason &&
				reason.Code === "ConditionalCheckFailed",
		)
	);
}
