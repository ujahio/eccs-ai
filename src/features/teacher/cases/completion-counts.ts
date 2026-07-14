import "server-only";

import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { queryAllDynamoItems } from "@/lib/aws/dynamodb-query";
import { getE2EAuthStore } from "@/lib/e2e/in-memory-auth";

export type TeacherCaseCompletionCounts = {
	completionCount: number;
	feedbackCount: number;
};

type StudentCaseCompletionCountRecord = {
	caseId: string;
	feedback?: unknown;
};

export function applyTeacherCaseCompletionCounts<T extends { caseId: string }>(
	cases: T[],
	counts: Map<string, TeacherCaseCompletionCounts>,
): Array<T & TeacherCaseCompletionCounts> {
	return cases.map((caseRecord) => ({
		...caseRecord,
		...(counts.get(caseRecord.caseId) ?? {
			completionCount: 0,
			feedbackCount: 0,
		}),
	}));
}

export function e2eTeacherCaseCompletionCounts(caseIds: string[]) {
	const caseIdSet = new Set(caseIds);

	return teacherCaseCompletionCountsFromRecords(
		Array.from(getE2EAuthStore().studentCaseCompletions.values()).filter(
			(completion) => caseIdSet.has(completion.caseId),
		),
	);
}

export async function dynamoTeacherCaseCompletionCounts(
	documentClient: DynamoDBDocumentClient,
	tableName: string,
	caseIds: string[],
) {
	const entries = await Promise.all(
		Array.from(new Set(caseIds)).map(
			async (caseId): Promise<[string, TeacherCaseCompletionCounts]> => [
				caseId,
				teacherCaseCompletionCountsFromRecords(
					await queryAllDynamoItems<StudentCaseCompletionCountRecord>(
						documentClient,
						{
							TableName: tableName,
							IndexName: "CaseCompletedAtIndex",
							KeyConditionExpression: "caseId = :caseId",
							ExpressionAttributeValues: {
								":caseId": caseId,
							},
						},
					),
				).get(caseId) ?? { completionCount: 0, feedbackCount: 0 },
			],
		),
	);

	return new Map(entries);
}

function teacherCaseCompletionCountsFromRecords(
	completions: StudentCaseCompletionCountRecord[],
) {
	const counts = new Map<string, TeacherCaseCompletionCounts>();

	for (const completion of completions) {
		const current = counts.get(completion.caseId) ?? {
			completionCount: 0,
			feedbackCount: 0,
		};

		counts.set(completion.caseId, {
			completionCount: current.completionCount + 1,
			feedbackCount:
				current.feedbackCount + (completion.feedback ? 1 : 0),
		});
	}

	return counts;
}
