import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getE2EAuthStore } from "@/lib/e2e/in-memory-auth";
import { teacherCaseRecordType } from "./case-lifecycle";

export type ActiveCaseArchivePayload = {
	caseId: string;
	deadlineAt: number;
};

export interface TeacherCaseArchiveRepository {
	markCaseArchived(args: ActiveCaseArchivePayload): Promise<boolean>;
}

export class TeacherCaseArchiveService {
	constructor(private readonly repository: TeacherCaseArchiveRepository) {}

	async archiveActiveCase(payload: ActiveCaseArchivePayload) {
		const archived = await this.repository.markCaseArchived(payload);

		return {
			archived,
			caseId: payload.caseId,
			deadlineAt: payload.deadlineAt,
		};
	}
}

export class InMemoryTeacherCaseArchiveRepository
	implements TeacherCaseArchiveRepository
{
	async markCaseArchived({ caseId, deadlineAt }: ActiveCaseArchivePayload) {
		const record = getE2EAuthStore().teacherCases.get(caseId);

		if (
			!record ||
			record.recordType !== teacherCaseRecordType ||
			record.lifecycle !== "published" ||
			record.deadlineAt !== deadlineAt
		) {
			return false;
		}

		getE2EAuthStore().teacherCases.set(caseId, {
			...record,
			lifecycle: "archived",
			archivedAt: deadlineAt,
		});

		return true;
	}
}

export class DynamoTeacherCaseArchiveRepository
	implements TeacherCaseArchiveRepository
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly teacherCaseTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async markCaseArchived({ caseId, deadlineAt }: ActiveCaseArchivePayload) {
		try {
			await this.documentClient.send(
				new UpdateCommand({
					TableName: this.teacherCaseTableName,
					Key: { caseId },
					UpdateExpression: "SET #lifecycle = :archived, archivedAt = :deadlineAt",
					ConditionExpression:
						"attribute_exists(caseId) AND #recordType = :caseRecordType AND #lifecycle = :published AND deadlineAt = :deadlineAt",
					ExpressionAttributeNames: {
						"#lifecycle": "lifecycle",
						"#recordType": "recordType",
					},
					ExpressionAttributeValues: {
						":archived": "archived",
						":caseRecordType": teacherCaseRecordType,
						":deadlineAt": deadlineAt,
						":published": "published",
					},
				}),
			);
		} catch (error) {
			if (errorName(error) === "ConditionalCheckFailedException") {
				return false;
			}

			throw error;
		}

		return true;
	}
}

export function activeCaseArchivePayloadFromEvent(
	event: unknown,
): ActiveCaseArchivePayload {
	if (typeof event !== "object" || event === null) {
		throw new Error("Active case archive event must be an object.");
	}

	const payload = event as Partial<ActiveCaseArchivePayload>;

	if (
		typeof payload.caseId !== "string" ||
		payload.caseId.trim().length === 0 ||
		typeof payload.deadlineAt !== "number" ||
		!Number.isFinite(payload.deadlineAt)
	) {
		throw new Error("Active case archive event is missing caseId or deadlineAt.");
	}

	return {
		caseId: payload.caseId,
		deadlineAt: payload.deadlineAt,
	};
}

function errorName(error: unknown) {
	return typeof error === "object" &&
		error !== null &&
		"name" in error &&
		typeof error.name === "string"
		? error.name
		: null;
}
