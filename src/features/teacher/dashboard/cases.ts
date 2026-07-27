import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { getE2ETeacherCaseStore, isE2EMode } from "@/lib/e2e/in-memory-auth";
import {
	isActiveTeacherCase,
	sortArchivedTeacherCases,
	type TeacherCaseLifecycle,
} from "@/features/teacher/cases/case-lifecycle";
import { areDemoCaseLifecycleControlsEnabled } from "@/lib/env/demo-case-lifecycle-controls";

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
	demoControlsEnabled: boolean;
};

type TeacherDashboardCaseSummary = Omit<
	TeacherDashboardSummary,
	"demoControlsEnabled"
>;

type StoredTeacherCaseRecord = TeacherDashboardCaseRecord & {
	lifecycle: TeacherCaseLifecycle;
};

type TeacherDashboardCaseRecordWithLifecycle = TeacherDashboardCaseRecord & {
	lifecycle: TeacherCaseLifecycle;
};

const recentArchivedLimit = 3;

export async function getTeacherDashboardSummary(): Promise<TeacherDashboardSummary> {
	const resources = getSessionAuthResources();
	const repository = isE2EMode()
		? new InMemoryTeacherDashboardRepository()
		: new DynamoTeacherDashboardRepository(resources.teacherCaseTableName);
	const summary = await repository.getSummary(Date.now());

	return {
		...summary,
		demoControlsEnabled: areDemoCaseLifecycleControlsEnabled(),
	};
}

export class InMemoryTeacherDashboardRepository {
	async getSummary(now: number): Promise<TeacherDashboardCaseSummary> {
		const cases = getE2ETeacherCaseStore();

		return summarizeCases(cases, now);
	}
}

export class DynamoTeacherDashboardRepository {
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly teacherCaseTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async getSummary(now: number): Promise<TeacherDashboardCaseSummary> {
		const [published, archived, expiredPublished] = await Promise.all([
			this.listActivePublishedCases(now),
			this.listArchivedCases(),
			this.listExpiredPublishedCases(now),
		]);

		const cases = [...published, ...archived, ...expiredPublished];

		return summarizeCases(cases, now);
	}

	private async listActivePublishedCases(now: number) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.teacherCaseTableName,
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
				Limit: recentArchivedLimit,
			}),
		);

		return (response.Items ?? []) as StoredTeacherCaseRecord[];
	}

	private async listArchivedCases() {
		const response = await this.documentClient.send(
			new QueryCommand({
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
				Limit: recentArchivedLimit,
			}),
		);

		return (response.Items ?? []) as StoredTeacherCaseRecord[];
	}
}

function summarizeCases(
	cases: StoredTeacherCaseRecord[],
	now: number,
): TeacherDashboardCaseSummary {
	const dashboardCases = cases.map(dashboardCaseRecord);
	const activeCase =
		dashboardCases
			.filter((caseRecord) => isActiveTeacherCase(caseRecord, now))
			.sort((a, b) => a.deadlineAt - b.deadlineAt)[0] ?? null;
	const archivedCases = sortArchivedTeacherCases(
		dashboardCases,
		now,
		recentArchivedLimit,
	);

	return {
		activeCase,
		archivedCases,
	};
}

function dashboardCaseRecord({
	completionCount,
	feedbackCount,
	...caseRecord
}: StoredTeacherCaseRecord): TeacherDashboardCaseRecordWithLifecycle {
	return {
		...caseRecord,
		completionCount,
		feedbackCount,
	};
}
