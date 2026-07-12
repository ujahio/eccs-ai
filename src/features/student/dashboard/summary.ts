import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { queryAllDynamoItems } from "@/lib/aws/dynamodb-query";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	getE2EStudentCertificateStore,
	getE2ETeacherCaseStore,
	isE2EMode,
} from "@/lib/e2e/in-memory-auth";

export type StudentDashboardActiveCase = {
	caseId: string;
	description: string;
	title: string;
	deadlineAt: number;
};

export type StudentDashboardCertificate = {
	certificateBranding: StudentDashboardCertificateBranding;
	certificateId: string;
	caseId: string;
	caseTitle: string;
	completedAt: number;
	studentDisplayName: string;
};

export type StudentDashboardCertificateBranding = {
	organizationName: string;
	shortName: string;
};

export type StudentDashboardSummary = {
	activeCase: StudentDashboardActiveCase | null;
	recentCertificates: StudentDashboardCertificate[];
};

type StudentDashboardRepository = {
	getSummary(
		studentProfileId: string,
		now: number,
	): Promise<StudentDashboardSummary>;
	listCertificates(
		studentProfileId: string,
		limit?: number,
	): Promise<StudentDashboardCertificate[]>;
	getCertificateById(
		studentProfileId: string,
		certificateId: string,
	): Promise<StudentDashboardCertificate | null>;
};

type StoredTeacherCaseRecord = Omit<StudentDashboardActiveCase, "description"> & {
	description?: string;
	draft?: {
		description?: unknown;
	};
	lifecycle: "published" | "archived" | "draft";
	publishedAt?: number;
};

type StoredStudentCertificateRecord = StudentDashboardCertificate & {
	studentProfileId: string;
};

const recentCertificateLimit = 3;

export async function getStudentDashboardSummary(
	studentProfileId: string,
): Promise<StudentDashboardSummary> {
	const repository = getStudentDashboardRepository();

	return repository.getSummary(studentProfileId, Date.now());
}

export async function getStudentCertificateHistory(
	studentProfileId: string,
): Promise<StudentDashboardCertificate[]> {
	const repository = getStudentDashboardRepository();

	return repository.listCertificates(studentProfileId);
}

export async function getStudentCertificateById(
	studentProfileId: string,
	certificateId: string,
): Promise<StudentDashboardCertificate | null> {
	const repository = getStudentDashboardRepository();

	return repository.getCertificateById(studentProfileId, certificateId);
}

function getStudentDashboardRepository(): StudentDashboardRepository {
	if (isE2EMode()) {
		return new InMemoryStudentDashboardRepository();
	}

	const resources = getSessionAuthResources();

	return new DynamoStudentDashboardRepository(
		resources.teacherCaseTableName,
		resources.studentCertificateTableName,
	);
}

export class InMemoryStudentDashboardRepository
	implements StudentDashboardRepository
{
	async getSummary(studentProfileId: string, now: number) {
		return {
			activeCase: activeCaseFromRecords(getE2ETeacherCaseStore(), now),
			recentCertificates: await this.listCertificates(
				studentProfileId,
				recentCertificateLimit,
			),
		};
	}

	async listCertificates(studentProfileId: string, limit?: number) {
		return certificatesFromRecords(
			getE2EStudentCertificateStore(studentProfileId),
			limit,
		);
	}

	async getCertificateById(studentProfileId: string, certificateId: string) {
		return (
			certificatesFromRecords(getE2EStudentCertificateStore(studentProfileId)).find(
				(certificate) => certificate.certificateId === certificateId,
			) ?? null
		);
	}
}

export class DynamoStudentDashboardRepository
	implements StudentDashboardRepository
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly teacherCaseTableName: string,
		private readonly studentCertificateTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async getSummary(studentProfileId: string, now: number) {
		const [activeCase, recentCertificates] = await Promise.all([
			this.getActiveCase(now),
			this.listCertificates(studentProfileId, recentCertificateLimit),
		]);

		return {
			activeCase,
			recentCertificates,
		};
	}

	private async getActiveCase(now: number) {
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
				Limit: 1,
			}),
		);

		return activeCaseFromRecords(response.Items ?? [], now);
	}

	async listCertificates(studentProfileId: string, limit?: number) {
		const input = {
			TableName: this.studentCertificateTableName,
			IndexName: "StudentCompletedAtIndex",
			KeyConditionExpression: "#studentProfileId = :studentProfileId",
			ExpressionAttributeNames: {
				"#studentProfileId": "studentProfileId",
			},
			ExpressionAttributeValues: {
				":studentProfileId": studentProfileId,
			},
			ScanIndexForward: false,
			...(typeof limit === "number" ? { Limit: limit } : {}),
		};

		if (typeof limit === "number") {
			const response = await this.documentClient.send(new QueryCommand(input));

			return certificatesFromRecords(response.Items ?? [], limit);
		}

		const records = await queryAllDynamoItems<StoredStudentCertificateRecord>(
			this.documentClient,
			input,
		);

		return certificatesFromRecords(records);
	}

	async getCertificateById(studentProfileId: string, certificateId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.studentCertificateTableName,
				Key: { certificateId },
			}),
		);

		const [certificate] = certificatesFromRecords(
			response.Item ? [response.Item] : [],
		);

		return certificate && response.Item?.studentProfileId === studentProfileId
			? certificate
			: null;
	}
}

function activeCaseFromRecords(records: unknown[], now: number) {
	const record =
		records
			.filter(isStoredTeacherCaseRecord)
			.filter((caseRecord) => isActiveTeacherCase(caseRecord, now))
			.sort((first, second) => first.deadlineAt - second.deadlineAt)[0] ??
		null;

	if (!record) {
		return null;
	}

	return {
		caseId: record.caseId,
		description: caseDescriptionFromRecord(record),
		title: record.title,
		deadlineAt: record.deadlineAt,
	};
}

function caseDescriptionFromRecord(record: StoredTeacherCaseRecord) {
	const draftDescription =
		typeof record.draft?.description === "string"
			? record.draft.description.trim()
			: "";
	const seededDescription = record.description?.trim() ?? "";

	return (
		draftDescription ||
		seededDescription ||
		"Review the active case presentation and begin your clinical reasoning."
	);
}

function certificatesFromRecords(records: unknown[], limit?: number) {
	const certificates = records
		.filter(isStoredStudentCertificateRecord)
		.sort((first, second) => second.completedAt - first.completedAt)
		.map((record) => ({
			certificateBranding: record.certificateBranding,
			certificateId: record.certificateId,
			caseId: record.caseId,
			caseTitle: record.caseTitle,
			completedAt: record.completedAt,
			studentDisplayName: record.studentDisplayName,
		}));

	return typeof limit === "number" ? certificates.slice(0, limit) : certificates;
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

function isStoredStudentCertificateRecord(
	record: unknown,
): record is StoredStudentCertificateRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<StoredStudentCertificateRecord>;

	return (
		isCertificateBranding(candidate.certificateBranding) &&
		typeof candidate.certificateId === "string" &&
		typeof candidate.caseId === "string" &&
		typeof candidate.caseTitle === "string" &&
		typeof candidate.completedAt === "number" &&
		typeof candidate.studentDisplayName === "string" &&
		typeof candidate.studentProfileId === "string"
	);
}

function isCertificateBranding(
	value: unknown,
): value is StudentDashboardCertificateBranding {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Partial<StudentDashboardCertificateBranding>;

	return (
		typeof candidate.organizationName === "string" &&
		candidate.organizationName.trim().length > 0 &&
		typeof candidate.shortName === "string" &&
		candidate.shortName.trim().length > 0
	);
}
