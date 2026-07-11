import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	getE2ETeacherCaseStore,
	isE2EMode,
} from "@/lib/e2e/in-memory-auth";

export type StudentCaseAttachmentDisposition = "inline" | "attachment";

export type StudentCaseResourceAttachment = {
	attachmentId: string;
	downloadUrl: string;
	name: string;
	size: number;
	type: string;
	viewUrl: string;
};

export type StudentCaseAttachmentFile = {
	bytes: Uint8Array;
	contentType: string;
	name: string;
};

export type StudentCasePresentation = {
	attachments: StudentCaseResourceAttachment[];
	caseId: string;
	deadlineAt: number;
	lectureText: string;
	modelAnswer: string;
	presentation: string;
};

type StudentCaseRepository = {
	getActiveCaseAttachment(
		caseId: string,
		attachmentId: string,
		now: number,
	): Promise<StudentCaseAttachmentFile | null>;
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
		attachments?: unknown;
		description?: unknown;
		lectureText?: unknown;
		modelAnswer?: unknown;
		presentation?: unknown;
	};
	lifecycle: "published" | "archived" | "draft";
	title: string;
};

const attachmentUrlTtlMilliseconds = 15 * 60 * 1_000;

export async function getStudentActiveCasePresentation(caseId: string) {
	return getStudentCaseRepository().getActiveCasePresentation(caseId, Date.now());
}

export async function getStudentCaseAttachment({
	attachmentId,
	caseId,
}: {
	attachmentId: string;
	caseId: string;
}) {
	return getStudentCaseRepository().getActiveCaseAttachment(
		caseId,
		attachmentId,
		Date.now(),
	);
}

function getStudentCaseRepository(): StudentCaseRepository {
	if (isE2EMode()) {
		return new InMemoryStudentCaseRepository();
	}

	const resources = getSessionAuthResources();

	return new DynamoStudentCaseRepository(
		resources.teacherCaseTableName,
		undefined,
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

	async getActiveCaseAttachment(
		caseId: string,
		attachmentId: string,
		now: number,
	) {
		const record =
			getE2ETeacherCaseStore().find(
				(caseRecord) =>
					isStoredTeacherCaseRecord(caseRecord) &&
					caseRecord.caseId === caseId,
			) ?? null;

		return activeAttachmentFromRecord(record, attachmentId, now);
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

	async getActiveCaseAttachment(
		caseId: string,
		attachmentId: string,
		now: number,
	) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.teacherCaseTableName,
				Key: { caseId },
			}),
		);

		return activeAttachmentFromRecord(response.Item ?? null, attachmentId, now);
	}
}

export function createStudentCaseAttachmentAccessUrl({
	attachmentId,
	caseId,
	disposition,
}: {
	attachmentId: string;
	caseId: string;
	disposition: StudentCaseAttachmentDisposition;
}) {
	const params = new URLSearchParams({ disposition });

	return `/student/cases/${encodeURIComponent(
		caseId,
	)}/attachments/${encodeURIComponent(attachmentId)}?${params.toString()}`;
}

export function createStudentCaseAttachmentUrl({
	attachmentId,
	caseId,
	disposition,
	expiresAt,
	secret,
}: {
	attachmentId: string;
	caseId: string;
	disposition: StudentCaseAttachmentDisposition;
	expiresAt: number;
	secret: string;
}) {
	const params = new URLSearchParams({
		disposition,
		expires: String(expiresAt),
		signature: studentCaseAttachmentSignature({
			attachmentId,
			caseId,
			disposition,
			expiresAt,
			secret,
		}),
	});

	return `/student/cases/${encodeURIComponent(
		caseId,
	)}/attachments/${encodeURIComponent(attachmentId)}?${params.toString()}`;
}

export function isValidStudentCaseAttachmentUrl({
	attachmentId,
	caseId,
	disposition,
	expiresAt,
	now,
	secret,
	signature,
}: {
	attachmentId: string;
	caseId: string;
	disposition: StudentCaseAttachmentDisposition;
	expiresAt: number;
	now: number;
	secret?: string;
	signature: string | null;
}) {
	if (!signature || !Number.isFinite(expiresAt) || expiresAt <= now) {
		return false;
	}

	const expected = studentCaseAttachmentSignature({
		attachmentId,
		caseId,
		disposition,
		expiresAt,
		secret: secret ?? getSessionAuthResources().betterAuthSecret,
	});
	const expectedBuffer = Buffer.from(expected);
	const signatureBuffer = Buffer.from(signature);

	return (
		expectedBuffer.byteLength === signatureBuffer.byteLength &&
		timingSafeEqual(expectedBuffer, signatureBuffer)
	);
}

function activePresentationFromRecord(
	record: unknown,
	now: number,
) {
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
	const lectureText =
		typeof record.draft?.lectureText === "string"
			? record.draft.lectureText.trim()
			: "";

	if (!presentation || !modelAnswer || !lectureText) {
		return null;
	}

	return {
		attachments: resourceAttachmentsFromRecord(record),
		caseId: record.caseId,
		deadlineAt: record.deadlineAt,
		lectureText,
		modelAnswer,
		presentation,
	};
}

function activeAttachmentFromRecord(
	record: unknown,
	attachmentId: string,
	now: number,
) {
	if (!isStoredTeacherCaseRecord(record) || !isActiveTeacherCase(record, now)) {
		return null;
	}

	const attachments = Array.isArray(record.draft?.attachments)
		? record.draft.attachments
		: [];

	for (const attachment of attachments) {
		const parsed = attachmentFileFromUnknown(attachment);

		if (parsed?.attachmentId === attachmentId) {
			return {
				bytes: parsed.bytes,
				contentType: parsed.contentType,
				name: parsed.name,
			};
		}
	}

	return null;
}

function resourceAttachmentsFromRecord(
	record: StoredTeacherCaseRecord,
) {
	const attachments = Array.isArray(record.draft?.attachments)
		? record.draft.attachments
		: [];

	return attachments.flatMap((attachment) => {
		const metadata = attachmentMetadataFromUnknown(attachment);

		if (!metadata) {
			return [];
		}

		return [
			{
				...metadata,
				downloadUrl: createStudentCaseAttachmentAccessUrl({
					attachmentId: metadata.attachmentId,
					caseId: record.caseId,
					disposition: "attachment",
				}),
				viewUrl: createStudentCaseAttachmentAccessUrl({
					attachmentId: metadata.attachmentId,
					caseId: record.caseId,
					disposition: "inline",
				}),
			},
		];
	});
}

function attachmentMetadataFromUnknown(
	value: unknown,
): Omit<StudentCaseResourceAttachment, "downloadUrl" | "viewUrl"> | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	const attachmentId = stringFromUnknown(candidate.id).trim();
	const dataUrl = stringFromUnknown(candidate.dataUrl).trim();
	const name = stringFromUnknown(candidate.name).trim();
	const size = numberFromUnknown(candidate.size);
	const type = stringFromUnknown(candidate.type).trim() || "application/pdf";

	if (
		!attachmentId ||
		!dataUrl ||
		!name ||
		!Number.isFinite(size) ||
		!isPdfAttachment({ dataUrl, name, type })
	) {
		return null;
	}

	return {
		attachmentId,
		name,
		size,
		type,
	};
}

function attachmentFileFromUnknown(value: unknown) {
	const metadata = attachmentMetadataFromUnknown(value);

	if (!metadata || typeof value !== "object" || value === null) {
		return null;
	}

	const dataUrl = stringFromUnknown((value as Record<string, unknown>).dataUrl);
	const decoded = pdfDataUrlBytes(dataUrl);

	if (!decoded) {
		return null;
	}

	return {
		...metadata,
		bytes: decoded.bytes,
		contentType: decoded.contentType,
	};
}

function pdfDataUrlBytes(dataUrl: string) {
	const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);

	if (!match) {
		return null;
	}

	const [, contentTypeValue = "application/pdf", encoding = "", payload = ""] =
		match;
	const contentType = contentTypeValue || "application/pdf";

	if (contentType !== "application/pdf") {
		return null;
	}

	try {
		const bytes =
			encoding === ";base64"
				? Buffer.from(payload, "base64")
				: Buffer.from(decodeURIComponent(payload), "utf8");

		return bytes.byteLength > 0 ? { bytes, contentType } : null;
	} catch {
		return null;
	}
}

function isPdfAttachment({
	dataUrl,
	name,
	type,
}: {
	dataUrl: string;
	name: string;
	type: string;
}) {
	return (
		type === "application/pdf" ||
		name.toLowerCase().endsWith(".pdf") ||
		dataUrl.startsWith("data:application/pdf")
	);
}

function studentCaseAttachmentSignature({
	attachmentId,
	caseId,
	disposition,
	expiresAt,
	secret,
}: {
	attachmentId: string;
	caseId: string;
	disposition: StudentCaseAttachmentDisposition;
	expiresAt: number;
	secret: string;
}) {
	return createHmac("sha256", secret)
		.update(`${caseId}\n${attachmentId}\n${disposition}\n${expiresAt}`)
		.digest("base64url");
}

function stringFromUnknown(value: unknown) {
	return typeof value === "string" ? value : "";
}

function numberFromUnknown(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function studentCaseAttachmentUrlExpiresAt(now: number) {
	return now + attachmentUrlTtlMilliseconds;
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
