import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { awsClientConfig } from "@/lib/aws/client-config";
import { queryAllDynamoItems } from "@/lib/aws/dynamodb-query-core";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { requireTeacherSession } from "@/lib/auth/session";
import {
	getE2EAuthStore,
	isE2EMode,
} from "@/lib/e2e/in-memory-auth";
import {
	isActiveTeacherCase,
	isArchivedTeacherCase,
	type TeacherCaseLifecycle,
} from "@/features/teacher/cases/case-lifecycle";
import type { StudentCaseFeedback } from "@/features/case-feedback/feedback";
import { studentCaseCompletionId } from "@/features/student-case-records/ids";

export type TeacherCaseReviewCase = {
	archivedAt?: number;
	caseId: string;
	deadlineAt: number;
	lifecycle: TeacherCaseLifecycle;
	publishedAt: number;
	title: string;
};

export type TeacherCaseReviewCompletion = {
	analysisLockedAt: number;
	analysisSubmittedAt: number;
	completedAt: number;
	feedback?: StudentCaseFeedback;
	personalAnalysis: string;
	studentDisplayName: string;
	studentProfileId: string;
};

export type TeacherCaseReview = {
	caseRecord: TeacherCaseReviewCase;
	completions: TeacherCaseReviewCompletion[];
};

type StoredTeacherCaseReviewRecord = TeacherCaseReviewCase & {
	teacherProfileId?: string;
};

type StoredStudentCaseCompletionRecord = TeacherCaseReviewCompletion & {
	caseId: string;
	certificateId: string;
	completionId: string;
};

type TeacherCaseReviewRepository = {
	getCase(caseId: string): Promise<StoredTeacherCaseReviewRecord | null>;
	getCompletion(
		caseId: string,
		studentProfileId: string,
	): Promise<TeacherCaseReviewCompletion | null>;
	listCompletions(caseId: string): Promise<TeacherCaseReviewCompletion[]>;
};

export async function getTeacherCaseReview(
	caseId: string,
): Promise<TeacherCaseReview | null> {
	const { profile } = await requireTeacherSession();
	const repository = getTeacherCaseReviewRepository();
	const caseRecord = await getAuthorizedTeacherReviewCase(
		repository,
		caseId,
		profile.profileId,
	);

	if (!caseRecord) {
		return null;
	}

	return {
		caseRecord: caseReviewCase(caseRecord),
		completions: await repository.listCompletions(caseId),
	};
}

export async function getTeacherStudentCaseResponse(
	caseId: string,
	studentProfileId: string,
) {
	const { profile } = await requireTeacherSession();
	const repository = getTeacherCaseReviewRepository();
	const caseRecord = await getAuthorizedTeacherReviewCase(
		repository,
		caseId,
		profile.profileId,
	);

	if (!caseRecord) {
		return null;
	}

	const completion = await repository.getCompletion(caseId, studentProfileId);

	return completion
		? { caseRecord: caseReviewCase(caseRecord), completion }
		: null;
}

export class InMemoryTeacherCaseReviewRepository
	implements TeacherCaseReviewRepository
{
	async getCase(caseId: string) {
		return getE2EAuthStore().teacherCases.get(caseId) ?? null;
	}

	async getCompletion(caseId: string, studentProfileId: string) {
		const completion =
			getE2EAuthStore().studentCaseCompletions.get(
				studentCaseCompletionId({ caseId, studentProfileId }),
			) ?? null;

		return completion ? completionReviewRecord(completion) : null;
	}

	async listCompletions(caseId: string) {
		return Array.from(getE2EAuthStore().studentCaseCompletions.values())
			.filter((completion) => completion.caseId === caseId)
			.sort((first, second) => second.completedAt - first.completedAt)
			.map(completionReviewRecord);
	}
}

export class DynamoTeacherCaseReviewRepository
	implements TeacherCaseReviewRepository
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly teacherCaseTableName: string,
		private readonly studentCaseCompletionTableName: string,
		documentClient = DynamoDBDocumentClient.from(
			new DynamoDBClient(awsClientConfig()),
		),
	) {
		this.documentClient = documentClient;
	}

	async getCase(caseId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.teacherCaseTableName,
				Key: { caseId },
			}),
		);

		return (response.Item ?? null) as StoredTeacherCaseReviewRecord | null;
	}

	async getCompletion(caseId: string, studentProfileId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.studentCaseCompletionTableName,
				Key: {
					completionId: studentCaseCompletionId({ caseId, studentProfileId }),
				},
			}),
		);
		const completion =
			(response.Item ?? null) as StoredStudentCaseCompletionRecord | null;

		if (
			!completion ||
			completion.caseId !== caseId ||
			completion.studentProfileId !== studentProfileId
		) {
			return null;
		}

		return completionReviewRecord(completion);
	}

	async listCompletions(caseId: string) {
		const records = await queryAllDynamoItems<StoredStudentCaseCompletionRecord>(
			this.documentClient,
			{
				TableName: this.studentCaseCompletionTableName,
				IndexName: "CaseCompletedAtIndex",
				KeyConditionExpression: "caseId = :caseId",
				ExpressionAttributeValues: {
					":caseId": caseId,
				},
				ScanIndexForward: false,
			},
		);

		return records.map(completionReviewRecord);
	}
}

function getTeacherCaseReviewRepository(): TeacherCaseReviewRepository {
	if (isE2EMode()) {
		return new InMemoryTeacherCaseReviewRepository();
	}

	const resources = getSessionAuthResources();

	return new DynamoTeacherCaseReviewRepository(
		resources.teacherCaseTableName,
		resources.studentCaseCompletionTableName,
	);
}

async function getAuthorizedTeacherReviewCase(
	repository: TeacherCaseReviewRepository,
	caseId: string,
	teacherProfileId: string,
) {
	const caseRecord = await repository.getCase(caseId);
	const now = Date.now();

	if (
		!caseRecord ||
		!isTeacherReviewCase(caseRecord, now) ||
		!isTeacherAuthorizedForCase(caseRecord, teacherProfileId)
	) {
		return null;
	}

	return caseRecord;
}

function isTeacherReviewCase(
	caseRecord: StoredTeacherCaseReviewRecord,
	now: number,
) {
	return (
		isActiveTeacherCase(caseRecord, now) ||
		isArchivedTeacherCase(caseRecord, now)
	);
}

function isTeacherAuthorizedForCase(
	caseRecord: StoredTeacherCaseReviewRecord,
	teacherProfileId: string,
) {
	return (
		!caseRecord.teacherProfileId ||
		caseRecord.teacherProfileId === teacherProfileId
	);
}

function caseReviewCase({
	archivedAt,
	caseId,
	deadlineAt,
	lifecycle,
	publishedAt,
	title,
}: StoredTeacherCaseReviewRecord): TeacherCaseReviewCase {
	return {
		...(archivedAt ? { archivedAt } : {}),
		caseId,
		deadlineAt,
		lifecycle,
		publishedAt,
		title,
	};
}

function completionReviewRecord({
	analysisLockedAt,
	analysisSubmittedAt,
	completedAt,
	feedback,
	personalAnalysis,
	studentDisplayName,
	studentProfileId,
}: StoredStudentCaseCompletionRecord): TeacherCaseReviewCompletion {
	return {
		analysisLockedAt,
		analysisSubmittedAt,
		completedAt,
		...(feedback ? { feedback } : {}),
		personalAnalysis,
		studentDisplayName,
		studentProfileId,
	};
}
