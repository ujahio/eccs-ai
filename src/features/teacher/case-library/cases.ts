import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
	getTeacherCaseDraftRepository,
	type TeacherCaseDraftListItem,
} from "@/features/teacher/case-authoring/drafts";
import {
	sortArchivedTeacherCases,
	type TeacherCaseLifecycle,
} from "@/features/teacher/cases/case-lifecycle";
import { queryAllDynamoItems } from "@/lib/aws/dynamodb-query-core";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { requireTeacherSession } from "@/lib/auth/session";
import { getE2ETeacherCaseStore, isE2EMode } from "@/lib/e2e/in-memory-auth";

export type TeacherCaseLibraryArchivedCase = {
	caseId: string;
	title: string;
	publishedAt: number;
	deadlineAt: number;
	archivedAt?: number;
	completionCount: number;
	feedbackCount: number;
};

export type TeacherCaseLibrarySummary = {
	draftCases: TeacherCaseDraftListItem[];
	archivedCases: TeacherCaseLibraryArchivedCase[];
};

type StoredTeacherCaseRecord = TeacherCaseLibraryArchivedCase & {
	lifecycle: TeacherCaseLifecycle;
};

export async function getTeacherCaseLibrary(): Promise<TeacherCaseLibrarySummary> {
	const { profile } = await requireTeacherSession();
	const resources = getSessionAuthResources();
	const archivedRepository = isE2EMode()
		? new InMemoryTeacherCaseLibraryRepository()
		: new DynamoTeacherCaseLibraryRepository(resources.teacherCaseTableName);
	const [draftCases, archivedCases] = await Promise.all([
		getTeacherCaseDraftRepository().listDrafts(profile.profileId),
		archivedRepository.listArchivedCases(Date.now()),
	]);

	return {
		draftCases,
		archivedCases,
	};
}

export class InMemoryTeacherCaseLibraryRepository {
	async listArchivedCases(now: number) {
		const cases = getE2ETeacherCaseStore();

		return sortArchivedCases(cases, now);
	}
}

export class DynamoTeacherCaseLibraryRepository {
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly teacherCaseTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async listArchivedCases(now: number) {
		const [archivedCases, expiredPublishedCases] = await Promise.all([
			queryAllDynamoItems<StoredTeacherCaseRecord>(
				this.documentClient,
				{
					TableName: this.teacherCaseTableName,
					IndexName: "LifecycleArchivedIndex",
					KeyConditionExpression: "#lifecycle = :archived",
					ExpressionAttributeNames: {
						"#lifecycle": "lifecycle",
					},
					ExpressionAttributeValues: {
						":archived": "archived",
					},
					ScanIndexForward: false,
				},
			),
			queryAllDynamoItems<StoredTeacherCaseRecord>(
				this.documentClient,
				{
					TableName: this.teacherCaseTableName,
					IndexName: "LifecycleDeadlineIndex",
					KeyConditionExpression: "#lifecycle = :published AND deadlineAt < :now",
					ExpressionAttributeNames: {
						"#lifecycle": "lifecycle",
					},
					ExpressionAttributeValues: {
						":published": "published",
						":now": now,
					},
					ScanIndexForward: false,
				},
			),
		]);

		return sortArchivedCases([...archivedCases, ...expiredPublishedCases], now);
	}
}

function sortArchivedCases(
	cases: StoredTeacherCaseRecord[],
	now: number,
): TeacherCaseLibraryArchivedCase[] {
	return sortArchivedTeacherCases(cases, now).map(
		({
			caseId,
			title,
			publishedAt,
			deadlineAt,
			archivedAt: storedArchivedAt,
			completionCount,
			feedbackCount,
		}) => ({
			caseId,
			title,
			publishedAt,
			deadlineAt,
			...(storedArchivedAt ? { archivedAt: storedArchivedAt } : {}),
			completionCount,
			feedbackCount,
		}),
	);
}
