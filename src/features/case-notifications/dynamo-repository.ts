import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { AppProfileRecord } from "@/features/auth/registration/repository";
import { awsClientConfig } from "@/lib/aws/client-config";
import { queryAllDynamoItems } from "@/lib/aws/dynamodb-query-core";
import { deadlineReminderLeadTimeMs } from "./service";
import type { CaseLifecycleNotificationRepository } from "./service";
import {
	caseLifecycleEmailRecipientsFromProfiles,
	deadlineReminderCasesFromRecords,
	type StoredStudentCertificateRecord,
	type StoredTeacherCaseRecord,
} from "./records";

export class DynamoCaseLifecycleNotificationRepository
	implements CaseLifecycleNotificationRepository
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly userProfileTableName: string,
		private readonly teacherCaseTableName: string,
		private readonly studentCertificateTableName: string,
		documentClient = DynamoDBDocumentClient.from(
			new DynamoDBClient(awsClientConfig()),
		),
	) {
		this.documentClient = documentClient;
	}

	async listCaseLifecycleEmailRecipients() {
		const profiles = await queryAllDynamoItems<AppProfileRecord>(
			this.documentClient,
			{
				TableName: this.userProfileTableName,
				IndexName: "RoleIndex",
				KeyConditionExpression: "#role = :student",
				ExpressionAttributeNames: {
					"#role": "role",
				},
				ExpressionAttributeValues: {
					":student": "student",
				},
			},
		);

		return caseLifecycleEmailRecipientsFromProfiles(profiles);
	}

	async listCasesReadyForDeadlineReminder(now: number) {
		const reminderThresholdAt = now + deadlineReminderLeadTimeMs;

		const records = await queryAllDynamoItems<StoredTeacherCaseRecord>(
			this.documentClient,
			{
				TableName: this.teacherCaseTableName,
				IndexName: "LifecycleDeadlineIndex",
				KeyConditionExpression:
					"#lifecycle = :published AND deadlineAt BETWEEN :now AND :thresholdAt",
				ExpressionAttributeNames: {
					"#lifecycle": "lifecycle",
				},
				ExpressionAttributeValues: {
					":published": "published",
					":now": now,
					":thresholdAt": reminderThresholdAt,
				},
			},
		);

		return deadlineReminderCasesFromRecords(records, now);
	}

	async hasEarnedActiveCaseCertificate({
		caseId,
		studentProfileId,
	}: {
		caseId: string;
		studentProfileId: string;
	}) {
		const records = await queryAllDynamoItems<StoredStudentCertificateRecord>(
			this.documentClient,
			{
				TableName: this.studentCertificateTableName,
				IndexName: "StudentCompletedAtIndex",
				KeyConditionExpression: "#studentProfileId = :studentProfileId",
				ExpressionAttributeNames: {
					"#studentProfileId": "studentProfileId",
				},
				ExpressionAttributeValues: {
					":studentProfileId": studentProfileId,
				},
			},
		);

		return records.some((record) => record.caseId === caseId);
	}

	async markDeadlineReminderSent({
		caseId,
		sentAt,
	}: {
		caseId: string;
		sentAt: number;
	}) {
		try {
			await this.documentClient.send(
				new UpdateCommand({
					TableName: this.teacherCaseTableName,
					Key: { caseId },
					UpdateExpression: "SET deadlineReminderSentAt = :sentAt",
					ConditionExpression:
						"attribute_exists(caseId) AND attribute_not_exists(deadlineReminderSentAt)",
					ExpressionAttributeValues: {
						":sentAt": sentAt,
					},
				}),
			);
		} catch (error) {
			if (errorName(error) !== "ConditionalCheckFailedException") {
				throw error;
			}
		}
	}
}

function errorName(error: unknown) {
	return typeof error === "object" &&
		error !== null &&
		"name" in error &&
		typeof error.name === "string"
		? error.name
		: null;
}
