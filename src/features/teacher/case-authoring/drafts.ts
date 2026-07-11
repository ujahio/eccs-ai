import "server-only";

import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	DeleteCommand,
	GetCommand,
	PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { teacherCaseRecordType } from "@/features/teacher/cases/case-lifecycle";
import {
	cleanupUploadedAttachments,
	deleteStoredAttachments,
	storeDraftAttachments,
} from "@/features/case-materials/storage";
import { queryAllDynamoItems } from "@/lib/aws/dynamodb-query";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	deleteE2ETeacherCaseDraftRecord,
	isE2EMode,
	getE2ETeacherCaseDraftRecord,
	listE2ETeacherCaseDraftRecords,
	saveE2ETeacherCaseDraftRecord,
} from "@/lib/e2e/in-memory-auth";
import {
	draftForEditing,
	draftForStorage,
	type CaseDraft,
} from "./schema";

export type TeacherCaseDraftRecord = {
	caseId: string;
	deadlineAt: number;
	draft: CaseDraft;
	feedbackCount: number;
	lifecycle: "draft";
	publishedAt: number;
	recordType: typeof teacherCaseRecordType;
	teacherProfileId: string;
	title: string;
	updatedAt: number;
	completionCount: number;
};

export type TeacherCaseDraft = CaseDraft & {
	caseId: string;
};

export type TeacherCaseDraftListItem = {
	attachmentCount: number;
	caseId: string;
	deadlineDate: string;
	description: string;
	title: string;
	updatedAt: number;
};

export type TeacherCaseDraftDeleteResult = {
	attachmentCount: number;
	caseId: string;
};

export interface TeacherCaseDraftRepository {
	deleteDraft(args: {
		caseId: string;
		teacherProfileId: string;
	}): Promise<TeacherCaseDraftDeleteResult | null>;
	getDraft(
		teacherProfileId: string,
		caseId?: string,
	): Promise<TeacherCaseDraft | null>;
	listDrafts(teacherProfileId: string): Promise<TeacherCaseDraftListItem[]>;
	saveDraft(args: {
		caseId?: string;
		draft: CaseDraft;
		now: number;
		teacherProfileId: string;
	}): Promise<TeacherCaseDraft | null>;
}

export function getTeacherCaseDraftRepository(): TeacherCaseDraftRepository {
	return isE2EMode()
		? new InMemoryTeacherCaseDraftRepository()
		: new DynamoTeacherCaseDraftRepository(
				getSessionAuthResources().teacherCaseTableName,
			);
}

export class InMemoryTeacherCaseDraftRepository
	implements TeacherCaseDraftRepository
{
	async deleteDraft({
		caseId,
		teacherProfileId,
	}: {
		caseId: string;
		teacherProfileId: string;
	}) {
		const record = getE2ETeacherCaseDraftRecord(teacherProfileId, caseId);

		if (!record) {
			return null;
		}

		deleteE2ETeacherCaseDraftRecord(teacherProfileId, caseId);
		await deleteStoredAttachments({ attachments: record.draft.attachments });

		return {
			attachmentCount: record.draft.attachments.length,
			caseId: record.caseId,
		};
	}

	async getDraft(teacherProfileId: string, caseId?: string) {
		const record = getE2ETeacherCaseDraftRecord(teacherProfileId, caseId);

		return record ? draftRecordForEditing(record) : null;
	}

	async listDrafts(teacherProfileId: string) {
		return listE2ETeacherCaseDraftRecords(teacherProfileId).map(
			draftRecordListItem,
		);
	}

	async saveDraft({
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
		const existingRecord = caseId
			? getE2ETeacherCaseDraftRecord(teacherProfileId, caseId)
			: null;
		const draftCaseId = existingRecord?.caseId ?? createTeacherCaseId();

		if (caseId && !existingRecord) {
			return null;
		}

		const storedAttachments = await storeDraftAttachments({
			attachments: draft.attachments,
			caseId: draftCaseId,
		});
		const storedDraft = draftForStorage({
			...draft,
			attachments: storedAttachments.attachments,
		});
		const record = {
			caseId: draftCaseId,
			draft: storedDraft,
			teacherProfileId,
			title: storedDraft.title.trim() || "Untitled draft",
			updatedAt: now,
		};

		saveE2ETeacherCaseDraftRecord(record);
		await deleteReplacedAttachments({
			nextAttachments: storedDraft.attachments,
			previousAttachments: existingRecord?.draft.attachments ?? [],
		});

		return draftRecordForEditing(record);
	}
}

export class DynamoTeacherCaseDraftRepository
	implements TeacherCaseDraftRepository
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly tableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async deleteDraft({
		caseId,
		teacherProfileId,
	}: {
		caseId: string;
		teacherProfileId: string;
	}) {
		const record = await this.getDraftRecordByCaseId(
			teacherProfileId,
			caseId,
		);

		if (!record) {
			return null;
		}

		await this.documentClient.send(
			new DeleteCommand({
				TableName: this.tableName,
				Key: { caseId },
			}),
		);
		await deleteStoredAttachments({ attachments: record.draft.attachments });

		return {
			attachmentCount: record.draft.attachments.length,
			caseId: record.caseId,
		};
	}

	async getDraft(teacherProfileId: string, caseId?: string) {
		const record = caseId
			? await this.getDraftRecordByCaseId(teacherProfileId, caseId)
			: await this.getLatestDraftRecord(teacherProfileId);

		return record ? draftRecordForEditing(record) : null;
	}

	async listDrafts(teacherProfileId: string) {
		const records = await this.listDraftRecords(teacherProfileId);

		return records
			.sort((first, second) => second.updatedAt - first.updatedAt)
			.map(draftRecordListItem);
	}

	async saveDraft({
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
		const existingRecord = caseId
			? await this.getDraftRecordByCaseId(teacherProfileId, caseId)
			: null;
		const draftCaseId = existingRecord?.caseId ?? createTeacherCaseId();

		if (caseId && !existingRecord) {
			return null;
		}

		const storedAttachments = await storeDraftAttachments({
			attachments: draft.attachments,
			caseId: draftCaseId,
		});
		const storedDraft = draftForStorage({
			...draft,
			attachments: storedAttachments.attachments,
		});

		const record: TeacherCaseDraftRecord = {
			caseId: draftCaseId,
			completionCount: 0,
			deadlineAt: 0,
			draft: storedDraft,
			feedbackCount: 0,
			lifecycle: "draft",
			publishedAt: 0,
			recordType: teacherCaseRecordType,
			teacherProfileId,
			title: storedDraft.title.trim() || "Untitled draft",
			updatedAt: now,
		};

		try {
			await this.documentClient.send(
				new PutCommand({
					TableName: this.tableName,
					Item: record,
				}),
			);
		} catch (error) {
			await cleanupUploadedAttachments({
				storageKeys: storedAttachments.uploadedStorageKeys,
			});
			throw error;
		}
		await deleteReplacedAttachments({
			nextAttachments: storedDraft.attachments,
			previousAttachments: existingRecord?.draft.attachments ?? [],
		});

		return draftRecordForEditing(record);
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
		const record = response.Item as unknown;

		if (!isTeacherCaseDraftRecord(record, teacherProfileId)) {
			return null;
		}

		return record;
	}

	private async getLatestDraftRecord(teacherProfileId: string) {
		const records = await this.listDraftRecords(teacherProfileId);

		return (
			records.sort((first, second) => second.updatedAt - first.updatedAt)[0] ??
			null
		);
	}

	private async listDraftRecords(teacherProfileId: string) {
		const records = await queryAllDynamoItems<TeacherCaseDraftRecord>(
			this.documentClient,
			{
				TableName: this.tableName,
				IndexName: "LifecycleDeadlineIndex",
				KeyConditionExpression: "#lifecycle = :draft",
				FilterExpression: "#teacherProfileId = :teacherProfileId",
				ExpressionAttributeNames: {
					"#lifecycle": "lifecycle",
					"#teacherProfileId": "teacherProfileId",
				},
				ExpressionAttributeValues: {
					":draft": "draft",
					":teacherProfileId": teacherProfileId,
				},
			},
		);

		return records.filter((record) => record.teacherProfileId === teacherProfileId);
	}
}

function createTeacherCaseId() {
	return randomUUID();
}

function isTeacherCaseDraftRecord(
	record: unknown,
	teacherProfileId: string,
): record is TeacherCaseDraftRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<TeacherCaseDraftRecord>;

	return (
		candidate.recordType === teacherCaseRecordType &&
		candidate.lifecycle === "draft" &&
		candidate.teacherProfileId === teacherProfileId
	);
}

function draftRecordForEditing(
	record: Pick<TeacherCaseDraftRecord, "caseId" | "draft">,
): TeacherCaseDraft {
	return {
		...draftForEditing(record.draft),
		caseId: record.caseId,
	};
}

function draftRecordListItem(
	record: Pick<TeacherCaseDraftRecord, "caseId" | "draft" | "title" | "updatedAt">,
): TeacherCaseDraftListItem {
	return {
		attachmentCount: record.draft.attachments.length,
		caseId: record.caseId,
		deadlineDate: record.draft.deadlineDate,
		description: record.draft.description,
		title: record.title,
		updatedAt: record.updatedAt,
	};
}

async function deleteReplacedAttachments({
	nextAttachments,
	previousAttachments,
}: {
	nextAttachments: CaseDraft["attachments"];
	previousAttachments: CaseDraft["attachments"];
}) {
	const nextStorageKeys = new Set(
		nextAttachments.flatMap((attachment) =>
			attachment.storageKey ? [attachment.storageKey] : [],
		),
	);

	await deleteStoredAttachments({
		attachments: previousAttachments.filter(
			(attachment) =>
				attachment.storageKey && !nextStorageKeys.has(attachment.storageKey),
		),
	});
}
