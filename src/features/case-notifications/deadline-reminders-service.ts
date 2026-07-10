import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	QueryCommand,
	type QueryCommandInput,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resend, type CreateEmailResponse } from "resend";
import { Resource } from "sst";
import type { AppProfileRecord } from "@/features/auth/registration/repository";
import { teacherCaseRecordType } from "@/features/teacher/cases/case-lifecycle";
import { eccsLogoAttachment } from "@/lib/email-templates/logo-attachment";
import {
	renderCaseDeadlineReminderEmail,
	studentDashboardUrl,
} from "@/lib/email-templates/transactional";
import {
	CaseLifecycleNotificationService,
	deadlineReminderLeadTimeMs,
	isEligibleForCaseLifecycleEmail,
	isReadyForDeadlineReminder,
	type CaseLifecycleEmail,
	type CaseLifecycleEmailRecipient,
	type CaseLifecycleEmailSender,
	type CaseLifecycleNotificationCase,
	type CaseLifecycleNotificationRepository,
} from "./service";

type CaseDeadlineReminderResources = {
	ResendApiKey: { value: string };
	UserProfileTable: { name: string };
	TeacherCaseTable: { name: string };
	StudentCertificateTable: { name: string };
};

type StoredTeacherCaseRecord = CaseLifecycleNotificationCase & {
	deadlineReminderSentAt?: number;
	lifecycle: "published" | "archived" | "draft";
	recordType?: string;
};

type StoredStudentCertificateRecord = {
	caseId: string;
	studentProfileId: string;
};

const linkedResources = Resource as unknown as Partial<CaseDeadlineReminderResources>;

export function getCaseDeadlineReminderService() {
	return new CaseLifecycleNotificationService(
		new LambdaCaseDeadlineReminderRepository(
			required(linkedValue(() => linkedResources.UserProfileTable?.name), "UserProfileTable.name"),
			required(linkedValue(() => linkedResources.TeacherCaseTable?.name), "TeacherCaseTable.name"),
			required(
				linkedValue(() => linkedResources.StudentCertificateTable?.name),
				"StudentCertificateTable.name",
			),
		),
		new ResendDeadlineReminderEmailSender(
			process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
			required(linkedValue(() => linkedResources.ResendApiKey?.value), "ResendApiKey.value"),
			process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
		),
	);
}

class LambdaCaseDeadlineReminderRepository
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

class ResendDeadlineReminderEmailSender implements CaseLifecycleEmailSender {
	private readonly client: Resend;

	constructor(
		private readonly sender: string,
		apiKey: string,
		private readonly appBaseUrl: string,
	) {
		this.client = new Resend(apiKey);
	}

	async sendNewCasePublishedEmail() {
		throw new Error("New-case publication emails are not sent by this Lambda.");
	}

	async sendDeadlineReminderEmail(email: CaseLifecycleEmail) {
		const content = await renderCaseDeadlineReminderEmail({
			caseTitle: email.caseTitle,
			deadlineAt: email.deadlineAt,
			firstName: email.firstName,
			studentDashboardUrl: studentDashboardUrl(this.appBaseUrl),
		});

		await sendResendEmail(
			this.client.emails.send({
				attachments: [eccsLogoAttachment()],
				from: this.sender,
				to: email.to,
				subject: "Complete your ECCS case before it closes",
				html: content.html,
				text: content.text,
			}),
		);
	}
}

async function queryAllDynamoItems<T>(
	documentClient: DynamoDBDocumentClient,
	input: QueryCommandInput,
) {
	const records: T[] = [];
	let exclusiveStartKey: QueryCommandInput["ExclusiveStartKey"];

	do {
		const response = await documentClient.send(
			new QueryCommand({
				...input,
				...(exclusiveStartKey
					? { ExclusiveStartKey: exclusiveStartKey }
					: {}),
			}),
		);

		records.push(...((response.Items ?? []) as T[]));
		exclusiveStartKey = response.LastEvaluatedKey;
	} while (exclusiveStartKey);

	return records;
}

async function sendResendEmail(send: Promise<CreateEmailResponse>) {
	const response = await send;

	if (response.error) {
		throw new Error(
			`Resend email failed: ${response.error.name}: ${response.error.message}`,
		);
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

function required(value: string | undefined, label: string) {
	if (!value) {
		throw new Error(`Missing required deadline reminder resource: ${label}`);
	}

	return value;
}

function linkedValue(read: () => string | undefined) {
	try {
		return read();
	} catch {
		return undefined;
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
