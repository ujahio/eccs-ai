import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { AppProfileRecord } from "@/features/auth/registration/repository";
import { teacherCaseRecordType } from "@/features/teacher/cases/case-lifecycle";
import { queryAllDynamoItems } from "@/lib/aws/dynamodb-query";
import {
	getE2EAuthStore,
	getE2EStudentCertificateStore,
	getE2ETeacherCaseStore,
} from "@/lib/e2e/in-memory-auth";
import {
	deadlineReminderLeadTimeMs,
	isEligibleForCaseLifecycleEmail,
	isReadyForDeadlineReminder,
	type CaseLifecycleEmailRecipient,
	type CaseLifecycleNotificationCase,
	type CaseLifecycleNotificationRepository,
} from "./service";

type StoredTeacherCaseRecord = CaseLifecycleNotificationCase & {
	deadlineReminderSentAt?: number;
	lifecycle: "published" | "archived" | "draft";
	recordType?: string;
};

type StoredStudentCertificateRecord = {
	caseId: string;
	studentProfileId: string;
};

export class InMemoryCaseLifecycleNotificationRepository
	implements CaseLifecycleNotificationRepository
{
	async listCaseLifecycleEmailRecipients() {
		return recipientsFromProfiles(
			Array.from(getE2EAuthStore().profiles.values()),
		);
	}

	async listCasesReadyForDeadlineReminder(now: number) {
		return getE2ETeacherCaseStore()
			.filter(isStoredTeacherCaseRecord)
			.filter((caseRecord) => isReadyForDeadlineReminder(caseRecord, now))
			.map(notificationCaseFromRecord);
	}

	async hasEarnedActiveCaseCertificate({
		caseId,
		studentProfileId,
	}: {
		caseId: string;
		studentProfileId: string;
	}) {
		return getE2EStudentCertificateStore(studentProfileId).some(
			(certificate) => certificate.caseId === caseId,
		);
	}

	async markDeadlineReminderSent({
		caseId,
		sentAt,
	}: {
		caseId: string;
		sentAt: number;
	}) {
		const record = getE2EAuthStore().teacherCases.get(caseId);

		if (!record) {
			return;
		}

		getE2EAuthStore().teacherCases.set(caseId, {
			...record,
			deadlineReminderSentAt: sentAt,
		});
	}
}

export class DynamoCaseLifecycleNotificationRepository
	implements CaseLifecycleNotificationRepository
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly userProfileTableName: string,
		private readonly teacherCaseTableName: string,
		private readonly studentCertificateTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
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

		return recipientsFromProfiles(profiles);
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

		return records
			.filter(isStoredTeacherCaseRecord)
			.filter((caseRecord) => isReadyForDeadlineReminder(caseRecord, now))
			.map(notificationCaseFromRecord);
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

function recipientsFromProfiles(
	profiles: unknown[],
): CaseLifecycleEmailRecipient[] {
	return profiles
		.filter(isAppProfileRecord)
		.filter(isEligibleForCaseLifecycleEmail)
		.map((profile) => ({
			email: profile.emailNormalized,
			firstName: profile.firstName,
			profileId: profile.profileId,
		}));
}

function notificationCaseFromRecord(
	record: StoredTeacherCaseRecord,
): CaseLifecycleNotificationCase {
	return {
		caseId: record.caseId,
		deadlineAt: record.deadlineAt,
		title: record.title,
	};
}

function isAppProfileRecord(record: unknown): record is AppProfileRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<AppProfileRecord>;

	return (
		typeof candidate.profileId === "string" &&
		typeof candidate.emailNormalized === "string" &&
		typeof candidate.firstName === "string" &&
		(candidate.role === "student" || candidate.role === "teacher")
	);
}

function isStoredTeacherCaseRecord(
	record: unknown,
): record is StoredTeacherCaseRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<StoredTeacherCaseRecord>;

	return (
		candidate.recordType === teacherCaseRecordType &&
		candidate.lifecycle === "published" &&
		typeof candidate.caseId === "string" &&
		typeof candidate.deadlineAt === "number" &&
		typeof candidate.title === "string"
	);
}

function errorName(error: unknown) {
	return typeof error === "object" &&
		error !== null &&
		"name" in error &&
		typeof error.name === "string"
		? error.name
		: null;
}
