import "server-only";

import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	PutCommand,
	QueryCommand,
	type QueryCommandInput,
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
		const record = await this.getDraftRecord(teacherProfileId);

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
		const existingRecord = await this.getDraftRecord(teacherProfileId);
		const record: TeacherCaseDraftRecord = {
			caseId: existingRecord?.caseId ?? createTeacherCaseId(),
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

	private async getDraftRecord(teacherProfileId: string) {
		const records = await this.listDraftRecords(teacherProfileId);

		return (
			records.sort((first, second) => second.updatedAt - first.updatedAt)[0] ??
			null
		);
	}

	private async listDraftRecords(teacherProfileId: string) {
		const records: TeacherCaseDraftRecord[] = [];
		let exclusiveStartKey: QueryCommandInput["ExclusiveStartKey"];

		do {
			const response = await this.documentClient.send(
				new QueryCommand({
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
					...(exclusiveStartKey
						? { ExclusiveStartKey: exclusiveStartKey }
						: {}),
				}),
			);

			records.push(
				...((response.Items ?? []) as TeacherCaseDraftRecord[]).filter(
					(record) => record.teacherProfileId === teacherProfileId,
				),
			);
			exclusiveStartKey = response.LastEvaluatedKey;
		} while (exclusiveStartKey);

		return records;
	}
}

function createTeacherCaseId() {
	return randomUUID();
}
