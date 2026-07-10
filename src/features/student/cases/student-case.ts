import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	getE2ETeacherCaseStore,
	isE2EMode,
} from "@/lib/e2e/in-memory-auth";

export type StudentCasePresentation = {
	caseId: string;
	deadlineAt: number;
	modelAnswer: string;
	presentation: string;
};

type StudentCaseRepository = {
	getActiveCasePresentation(
		caseId: string,
		now: number,
	): Promise<StudentCasePresentation | null>;
};

type StoredTeacherCaseRecord = {
	caseId: string;
	deadlineAt: number;
	description?: string;
	draft?: {
		description?: unknown;
		modelAnswer?: unknown;
		presentation?: unknown;
	};
	lifecycle: "published" | "archived" | "draft";
	title: string;
};

export async function getStudentActiveCasePresentation(caseId: string) {
	return getStudentCaseRepository().getActiveCasePresentation(caseId, Date.now());
}

function getStudentCaseRepository(): StudentCaseRepository {
	if (isE2EMode()) {
		return new InMemoryStudentCaseRepository();
	}

	return new DynamoStudentCaseRepository(
		getSessionAuthResources().teacherCaseTableName,
	);
}

export class InMemoryStudentCaseRepository implements StudentCaseRepository {
	async getActiveCasePresentation(caseId: string, now: number) {
		const record =
			getE2ETeacherCaseStore().find(
				(caseRecord) =>
					isStoredTeacherCaseRecord(caseRecord) &&
					caseRecord.caseId === caseId,
			) ?? null;

		return activePresentationFromRecord(record, now);
	}
}

export class DynamoStudentCaseRepository implements StudentCaseRepository {
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly teacherCaseTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async getActiveCasePresentation(caseId: string, now: number) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.teacherCaseTableName,
				Key: { caseId },
			}),
		);

		return activePresentationFromRecord(response.Item ?? null, now);
	}
}

function activePresentationFromRecord(record: unknown, now: number) {
	if (!isStoredTeacherCaseRecord(record) || !isActiveTeacherCase(record, now)) {
		return null;
	}

	const presentation =
		typeof record.draft?.presentation === "string"
			? record.draft.presentation.trim()
			: "";
	const modelAnswer =
		typeof record.draft?.modelAnswer === "string"
			? record.draft.modelAnswer.trim()
			: "";

	if (!presentation || !modelAnswer) {
		return null;
	}

	return {
		caseId: record.caseId,
		deadlineAt: record.deadlineAt,
		modelAnswer,
		presentation,
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
		typeof candidate.caseId === "string" &&
		typeof candidate.title === "string" &&
		typeof candidate.deadlineAt === "number" &&
		(candidate.lifecycle === "published" ||
			candidate.lifecycle === "archived" ||
			candidate.lifecycle === "draft")
	);
}
