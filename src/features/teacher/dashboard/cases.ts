import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { getE2ETeacherCaseStore, isE2EMode } from "@/lib/e2e/in-memory-auth";

export type TeacherDashboardCaseRecord = {
	caseId: string;
	title: string;
	publishedAt: number;
	deadlineAt: number;
	archivedAt?: number;
	completionCount: number;
	feedbackCount: number;
};

export type TeacherDashboardSummary = {
	activeCase: TeacherDashboardCaseRecord | null;
	archivedCases: TeacherDashboardCaseRecord[];
};

type StoredTeacherCaseRecord = TeacherDashboardCaseRecord & {
	lifecycle: "published" | "archived" | "draft";
};

const recentArchivedLimit = 3;

export async function getTeacherDashboardSummary(): Promise<TeacherDashboardSummary> {
	const repository = isE2EMode()
		? new InMemoryTeacherDashboardRepository()
		: new DynamoTeacherDashboardRepository(
				getSessionAuthResources().teacherCaseTableName,
			);

	return repository.getSummary(Date.now());
}

export class InMemoryTeacherDashboardRepository {
	async getSummary(now: number): Promise<TeacherDashboardSummary> {
		return summarizeCases(getE2ETeacherCaseStore(), now);
	}
}

export class DynamoTeacherDashboardRepository {
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly tableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async getSummary(now: number): Promise<TeacherDashboardSummary> {
		const [published, archived, expiredPublished] = await Promise.all([
			this.listActivePublishedCases(now),
			this.listArchivedCases(),
			this.listExpiredPublishedCases(now),
		]);

		return summarizeCases([...published, ...archived, ...expiredPublished], now);
	}

	private async listActivePublishedCases(now: number) {
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
				ScanIndexForward: true,
				Limit: 5,
			}),
		);

		return (response.Items ?? []) as StoredTeacherCaseRecord[];
	}

	private async listExpiredPublishedCases(now: number) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.tableName,
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
				Limit: recentArchivedLimit,
			}),
		);

		return (response.Items ?? []) as StoredTeacherCaseRecord[];
	}

	private async listArchivedCases() {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.tableName,
				IndexName: "LifecycleArchivedIndex",
				KeyConditionExpression: "#lifecycle = :archived",
				ExpressionAttributeNames: {
					"#lifecycle": "lifecycle",
				},
				ExpressionAttributeValues: {
					":archived": "archived",
				},
				ScanIndexForward: false,
				Limit: recentArchivedLimit,
			}),
		);

		return (response.Items ?? []) as StoredTeacherCaseRecord[];
	}
}

function summarizeCases(
	cases: StoredTeacherCaseRecord[],
	now: number,
): TeacherDashboardSummary {
	const activeCase =
		cases
			.filter((caseRecord) => isActiveCase(caseRecord, now))
			.sort((a, b) => a.deadlineAt - b.deadlineAt)[0] ?? null;
	const archivedCases = cases
		.filter((caseRecord) => isArchivedCase(caseRecord, now))
		.sort((a, b) => archivedAt(b, now) - archivedAt(a, now))
		.slice(0, recentArchivedLimit);

	return {
		activeCase,
		archivedCases,
	};
}

function isActiveCase(caseRecord: StoredTeacherCaseRecord, now: number) {
	return caseRecord.lifecycle === "published" && caseRecord.deadlineAt >= now;
}

function isArchivedCase(caseRecord: StoredTeacherCaseRecord, now: number) {
	return (
		caseRecord.lifecycle === "archived" ||
		(caseRecord.lifecycle === "published" && caseRecord.deadlineAt < now)
	);
}

function archivedAt(caseRecord: StoredTeacherCaseRecord, now: number) {
	return caseRecord.archivedAt ?? Math.min(caseRecord.deadlineAt, now);
}
