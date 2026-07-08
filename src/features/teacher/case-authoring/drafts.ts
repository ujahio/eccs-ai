import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	getE2ETeacherCaseDraft,
	isE2EMode,
	saveE2ETeacherCaseDraft,
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
	teacherProfileId: string;
	title: string;
	updatedAt: number;
	completionCount: number;
};

export interface TeacherCaseDraftRepository {
	getDraft(teacherProfileId: string): Promise<CaseDraft | null>;
	saveDraft(args: {
		draft: CaseDraft;
		now: number;
		teacherProfileId: string;
	}): Promise<CaseDraft>;
}

export function getTeacherCaseDraftRepository(): TeacherCaseDraftRepository {
	return isE2EMode()
		? new InMemoryTeacherCaseDraftRepository()
		: new DynamoTeacherCaseDraftRepository(
				getSessionAuthResources().teacherCaseTableName,
			);
}

export function teacherDraftCaseId(teacherProfileId: string) {
	return `draft#${teacherProfileId}`;
}

export class InMemoryTeacherCaseDraftRepository
	implements TeacherCaseDraftRepository
{
	async getDraft(teacherProfileId: string) {
		return getE2ETeacherCaseDraft(teacherProfileId);
	}

	async saveDraft({
		draft,
		teacherProfileId,
	}: {
		draft: CaseDraft;
		now: number;
		teacherProfileId: string;
	}) {
		const storedDraft = draftForStorage(draft);

		saveE2ETeacherCaseDraft(teacherProfileId, storedDraft);

		return draftForEditing(storedDraft);
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

	async getDraft(teacherProfileId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.tableName,
				Key: { caseId: teacherDraftCaseId(teacherProfileId) },
			}),
		);
		const record = response.Item as TeacherCaseDraftRecord | undefined;

		return record?.draft ? draftForEditing(record.draft) : null;
	}

	async saveDraft({
		draft,
		now,
		teacherProfileId,
	}: {
		draft: CaseDraft;
		now: number;
		teacherProfileId: string;
	}) {
		const storedDraft = draftForStorage(draft);
		const record: TeacherCaseDraftRecord = {
			caseId: teacherDraftCaseId(teacherProfileId),
			completionCount: 0,
			deadlineAt: 0,
			draft: storedDraft,
			feedbackCount: 0,
			lifecycle: "draft",
			publishedAt: 0,
			teacherProfileId,
			title: storedDraft.title.trim() || "Untitled draft",
			updatedAt: now,
		};

		await this.documentClient.send(
			new PutCommand({
				TableName: this.tableName,
				Item: record,
			}),
		);

		return draftForEditing(storedDraft);
	}
}
