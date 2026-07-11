import "server-only";

import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	QueryCommand,
	TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
	isActiveTeacherCase,
	teacherCaseRecordType,
} from "@/features/teacher/cases/case-lifecycle";
import {
	cleanupUploadedAttachments,
	storeDraftAttachments,
} from "@/features/case-materials/storage";
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
	recordType: typeof teacherCaseRecordType;
	teacherProfileId: string;
	title: string;
};

export type PublishTeacherCaseDraftArgs = {
	caseId?: string;
	draft: CaseDraft;
	now: number;
	teacherProfileId: string;
};

const activeCaseLockCaseId = "teacher-case-active-lock";
const activeCaseLockRecordType = "activeCaseLock";

type StoredTeacherCaseRecord = Omit<PublishedTeacherCaseRecord, "lifecycle"> & {
	archivedAt?: number;
	lifecycle: "published" | "archived" | "draft";
};

type ActiveCaseLockRecord = {
	caseId: typeof activeCaseLockCaseId;
	deadlineAt: number;
	publishedCaseId: string;
	recordType: typeof activeCaseLockRecordType;
	updatedAt: number;
};

type PreparedTeacherCaseDraft = PublishTeacherCaseDraftArgs & {
	deadlineAt: number;
};

type ExistingTeacherCaseDraft = {
	caseId: string;
} | null;

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
	publishDraft(
		args: PublishTeacherCaseDraftArgs,
	): Promise<PublishedTeacherCaseRecord>;
}

export function getTeacherCasePublisher(): TeacherCasePublisher {
	return isE2EMode()
		? new InMemoryTeacherCasePublisher()
		: new DynamoTeacherCasePublisher(
				getSessionAuthResources().teacherCaseTableName,
			);
}

export class InMemoryTeacherCasePublisher implements TeacherCasePublisher {
	async publishDraft(args: PublishTeacherCaseDraftArgs) {
		const preparedDraft = prepareTeacherCaseDraftForPublish(args);

		if (hasActivePublishedCase(getE2ETeacherCaseStore(), preparedDraft.now)) {
			throw new ActivePublishedCaseError();
		}

		const existingDraft = preparedDraft.caseId
			? getE2ETeacherCaseDraftRecord(
					preparedDraft.teacherProfileId,
					preparedDraft.caseId,
				)
			: null;

		const record = publishedCaseRecordFromPreparedDraft(
			preparedDraft,
			existingDraft,
		);
		const { record: storedRecord } =
			await publishedCaseRecordWithStoredAttachments(record);

		saveE2ETeacherCaseRecord(storedRecord);

		if (existingDraft) {
			deleteE2ETeacherCaseDraftRecord(
				preparedDraft.teacherProfileId,
				existingDraft.caseId,
			);
		}

		return storedRecord;
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

	async publishDraft(args: PublishTeacherCaseDraftArgs) {
		const preparedDraft = prepareTeacherCaseDraftForPublish(args);

		const [activeCase, existingDraft] = await Promise.all([
			this.getActivePublishedCase(preparedDraft.now),
			preparedDraft.caseId
				? this.getDraftRecordByCaseId(
						preparedDraft.teacherProfileId,
						preparedDraft.caseId,
					)
				: Promise.resolve(null),
		]);

		if (activeCase) {
			throw new ActivePublishedCaseError();
		}

		const record = publishedCaseRecordFromPreparedDraft(
			preparedDraft,
			existingDraft,
		);
		const {
			record: storedRecord,
			uploadedStorageKeys,
		} = await publishedCaseRecordWithStoredAttachments(record);

		try {
			await this.documentClient.send(
				new TransactWriteCommand({
					TransactItems: [
						{
							Put: {
								TableName: this.tableName,
								Item: activeCaseLockRecord(storedRecord, preparedDraft.now),
								ConditionExpression:
									"attribute_not_exists(caseId) OR deadlineAt < :now",
								ExpressionAttributeValues: {
									":now": preparedDraft.now,
								},
							},
						},
						{
							Put: existingDraft
								? {
										TableName: this.tableName,
										Item: storedRecord,
										ConditionExpression:
											"#recordType = :caseRecordType AND #lifecycle = :draft AND #teacherProfileId = :teacherProfileId",
										ExpressionAttributeNames: {
											"#lifecycle": "lifecycle",
											"#recordType": "recordType",
											"#teacherProfileId": "teacherProfileId",
										},
										ExpressionAttributeValues: {
											":caseRecordType": teacherCaseRecordType,
											":draft": "draft",
											":teacherProfileId": preparedDraft.teacherProfileId,
										},
									}
								: {
										TableName: this.tableName,
										Item: storedRecord,
										ConditionExpression: "attribute_not_exists(caseId)",
									},
						},
					],
				}),
			);
		} catch (error) {
			await cleanupUploadedAttachments({
				storageKeys: uploadedStorageKeys,
			});
			if (isConditionalCheckFailed(error)) {
				if (await this.getActivePublishedCase(preparedDraft.now)) {
					throw new ActivePublishedCaseError();
				}

				throw new PublishDraftNotFoundError();
			}

			throw error;
		}

		return storedRecord;
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

		const record = (response.Items ?? [])[0];

		return isStoredTeacherCaseRecord(record) && record.lifecycle === "published"
			? record
			: null;
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
		const record = response.Item;

		if (
			!isStoredTeacherCaseRecord(record) ||
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

function prepareTeacherCaseDraftForPublish(
	args: PublishTeacherCaseDraftArgs,
): PreparedTeacherCaseDraft {
	const deadlineAt = deadlineAtFromDubaiDate(args.draft.deadlineDate);
	const validation = validateDraftForPublishAt(args.draft, args.now, deadlineAt);

	if (Object.keys(validation).length > 0 || deadlineAt === null) {
		throw new PublishValidationError(validation);
	}

	return { ...args, deadlineAt };
}

function publishedCaseRecordFromPreparedDraft(
	{ caseId, deadlineAt, draft, now, teacherProfileId }: PreparedTeacherCaseDraft,
	existingDraft: ExistingTeacherCaseDraft,
) {
	if (caseId && !existingDraft) {
		throw new PublishDraftNotFoundError();
	}

	return publishedCaseRecord({
		caseId: existingDraft?.caseId ?? caseId ?? createTeacherCaseId(),
		deadlineAt,
		draft,
		now,
		teacherProfileId,
	});
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
		recordType: teacherCaseRecordType,
		teacherProfileId,
		title: storedDraft.title.trim(),
	};
}

async function publishedCaseRecordWithStoredAttachments(
	record: PublishedTeacherCaseRecord,
) {
	const storedAttachments = await storeDraftAttachments({
		attachments: record.draft.attachments,
		caseId: record.caseId,
	});

	return {
		record: {
			...record,
			draft: draftForStorage({
				...record.draft,
				attachments: storedAttachments.attachments,
			}),
		},
		uploadedStorageKeys: storedAttachments.uploadedStorageKeys,
	};
}

function validateDraftForPublishAt(
	draft: CaseDraft,
	now: number,
	deadlineAt: number | null,
) {
	const validation = validateDraftForPublish(draft);

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
): ActiveCaseLockRecord {
	return {
		caseId: activeCaseLockCaseId,
		deadlineAt: record.deadlineAt,
		publishedCaseId: record.caseId,
		recordType: activeCaseLockRecordType,
		updatedAt: now,
	};
}

function isStoredTeacherCaseRecord(
	record: unknown,
): record is StoredTeacherCaseRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<StoredTeacherCaseRecord>;

	return (
		candidate.recordType === teacherCaseRecordType &&
		(candidate.lifecycle === "published" ||
			candidate.lifecycle === "archived" ||
			candidate.lifecycle === "draft")
	);
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
