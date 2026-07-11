import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	getE2EAuthStore,
	getE2ETeacherCaseStore,
	isE2EMode,
	saveE2EStudentCertificate,
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
	contentType: string;
	name: string;
	storageKey: string;
};

export type StudentCasePresentation = {
	attachments: StudentCaseResourceAttachment[];
	caseId: string;
	cmeQuestions: StudentCaseQuizQuestion[];
	deadlineAt: number;
	lectureText: string;
	modelAnswer: string;
	presentation: string;
	title: string;
};

export type StudentCaseQuizOption = {
	optionId: string;
	text: string;
};

export type StudentCaseQuizQuestion = {
	options: StudentCaseQuizOption[];
	prompt: string;
	questionId: string;
};

export type CompleteStudentCaseQuizArgs = {
	answers: Record<string, string>;
	caseId: string;
	studentDisplayName: string;
	studentProfileId: string;
};

export type CompleteStudentCaseQuizResult =
	| {
			certificateId: string;
			status: "passed";
	  }
	| {
			status: "failed";
	  };

export type StudentCaseCertificateRecord = {
	certificateId: string;
	caseId: string;
	caseTitle: string;
	completedAt: number;
	studentDisplayName: string;
	studentProfileId: string;
};

type StudentCaseRepository = {
	createStudentCaseCertificate(
		record: StudentCaseCertificateRecord,
		now: number,
	): Promise<void>;
	getActiveCaseAttachment(
		caseId: string,
		attachmentId: string,
		now: number,
	): Promise<StudentCaseAttachmentFile | null>;
	getActiveCasePresentation(
		caseId: string,
		now: number,
	): Promise<StudentCasePresentation | null>;
	getActiveCaseQuiz(
		caseId: string,
		now: number,
	): Promise<StudentCaseQuizCase | null>;
};

type StoredTeacherCaseRecord = {
	caseId: string;
	deadlineAt: number;
	description?: string;
	draft?: {
		attachments?: unknown;
		cmeQuestions?: unknown;
		description?: unknown;
		lectureText?: unknown;
		modelAnswer?: unknown;
		presentation?: unknown;
	};
	lifecycle: "published" | "archived" | "draft";
	title: string;
};

type StoredStudentCaseQuizQuestion = StudentCaseQuizQuestion & {
	correctOptionId: string;
};

type StudentCaseQuizCase = {
	caseId: string;
	deadlineAt: number;
	questions: StoredStudentCaseQuizQuestion[];
	title: string;
};

const attachmentUrlTtlMilliseconds = 15 * 60 * 1_000;

export async function getStudentActiveCasePresentation(caseId: string) {
	return getStudentCaseRepository().getActiveCasePresentation(caseId, Date.now());
}

export async function completeStudentCaseQuiz({
	answers,
	caseId,
	studentDisplayName,
	studentProfileId,
}: CompleteStudentCaseQuizArgs): Promise<CompleteStudentCaseQuizResult> {
	const repository = getStudentCaseRepository();
	const now = Date.now();
	const caseRecord = await repository.getActiveCaseQuiz(caseId, now);

	if (!caseRecord) {
		throw new StudentCaseExpiredError();
	}

	if (!isPassingStudentCaseQuiz(caseRecord.questions, answers)) {
		return { status: "failed" };
	}

	const certificateId = studentCaseCertificateId({
		caseId,
		studentProfileId,
	});

	await repository.createStudentCaseCertificate(
		{
			certificateId,
			caseId,
			caseTitle: caseRecord.title,
			completedAt: now,
			studentDisplayName,
			studentProfileId,
		},
		now,
	);

	return {
		certificateId,
		status: "passed",
	};
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
		resources.studentCertificateTableName,
	);
}

export class InMemoryStudentCaseRepository implements StudentCaseRepository {
	async createStudentCaseCertificate(
		record: StudentCaseCertificateRecord,
		now: number,
	) {
		const store = getE2EAuthStore();
		const caseRecord = store.teacherCases.get(record.caseId);

		if (store.studentCertificates.has(record.certificateId)) {
			throw new DuplicateStudentCaseCertificateError();
		}

		if (!caseRecord || !isActiveTeacherCase(caseRecord, now)) {
			throw new StudentCaseExpiredError();
		}

		saveE2EStudentCertificate(record);
		store.teacherCases.set(record.caseId, {
			...caseRecord,
			completionCount: caseRecord.completionCount + 1,
		});
	}

	async getActiveCasePresentation(caseId: string, now: number) {
		const record =
			getE2ETeacherCaseStore().find(
				(caseRecord) =>
					isStoredTeacherCaseRecord(caseRecord) &&
					caseRecord.caseId === caseId,
			) ?? null;

		return activePresentationFromRecord(record, now);
	}

	async getActiveCaseQuiz(caseId: string, now: number) {
		const record =
			getE2ETeacherCaseStore().find(
				(caseRecord) =>
					isStoredTeacherCaseRecord(caseRecord) &&
					caseRecord.caseId === caseId,
			) ?? null;

		return activeQuizCaseFromRecord(record, now);
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
	private readonly studentCertificateTableName: string;

	constructor(
		private readonly teacherCaseTableName: string,
		studentCertificateTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.studentCertificateTableName = studentCertificateTableName;
		this.documentClient = documentClient;
	}

	async createStudentCaseCertificate(
		record: StudentCaseCertificateRecord,
		now: number,
	) {
		try {
			await this.documentClient.send(
				new TransactWriteCommand({
					TransactItems: [
						{
							Put: {
								TableName: this.studentCertificateTableName,
								Item: record,
								ConditionExpression: "attribute_not_exists(certificateId)",
							},
						},
						{
							Update: {
								TableName: this.teacherCaseTableName,
								Key: { caseId: record.caseId },
								UpdateExpression:
									"SET completionCount = if_not_exists(completionCount, :zero) + :one",
								ConditionExpression:
									"attribute_exists(caseId) AND #lifecycle = :published AND deadlineAt >= :now",
								ExpressionAttributeNames: {
									"#lifecycle": "lifecycle",
								},
								ExpressionAttributeValues: {
									":now": now,
									":one": 1,
									":published": "published",
									":zero": 0,
								},
							},
						},
					],
				}),
			);
		} catch (error) {
			if (!isConditionalWriteFailure(error)) {
				throw error;
			}

			if (await this.hasCertificate(record.certificateId)) {
				throw new DuplicateStudentCaseCertificateError();
			}

			throw new StudentCaseExpiredError();
		}
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

	async getActiveCaseQuiz(caseId: string, now: number) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.teacherCaseTableName,
				Key: { caseId },
			}),
		);

		return activeQuizCaseFromRecord(response.Item ?? null, now);
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

	private async hasCertificate(certificateId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.studentCertificateTableName,
				Key: { certificateId },
			}),
		);

		return Boolean(response.Item);
	}
}

export class StudentCaseExpiredError extends Error {
	constructor() {
		super("This case is no longer active.");
		this.name = "StudentCaseExpiredError";
	}
}

export class DuplicateStudentCaseCertificateError extends Error {
	constructor() {
		super("A certificate has already been earned for this case.");
		this.name = "DuplicateStudentCaseCertificateError";
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

	const cmeQuestions = studentQuizQuestionsFromRecord(record);

	if (cmeQuestions.length < 3 || cmeQuestions.length > 5) {
		return null;
	}

	return {
		attachments: resourceAttachmentsFromRecord(record),
		caseId: record.caseId,
		cmeQuestions,
		deadlineAt: record.deadlineAt,
		lectureText,
		modelAnswer,
		presentation,
		title: record.title,
	};
}

function activeQuizCaseFromRecord(
	record: unknown,
	now: number,
): StudentCaseQuizCase | null {
	if (!isStoredTeacherCaseRecord(record) || !isActiveTeacherCase(record, now)) {
		return null;
	}

	const questions = storedQuizQuestionsFromRecord(record);

	if (questions.length < 3 || questions.length > 5) {
		return null;
	}

	return {
		caseId: record.caseId,
		deadlineAt: record.deadlineAt,
		questions,
		title: record.title,
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
				contentType: parsed.contentType,
				name: parsed.name,
				storageKey: parsed.storageKey,
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
	const name = stringFromUnknown(candidate.name).trim();
	const size = numberFromUnknown(candidate.size);
	const storageKey = stringFromUnknown(candidate.storageKey).trim();
	const type = stringFromUnknown(candidate.type).trim() || "application/pdf";

	if (
		!attachmentId ||
		!storageKey ||
		!name ||
		!Number.isFinite(size) ||
		!isPdfAttachment({ name, type })
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

	const storageKey = stringFromUnknown(
		(value as Record<string, unknown>).storageKey,
	).trim();

	if (storageKey) {
		return {
			...metadata,
			contentType: metadata.type,
			storageKey,
		};
	}

	return null;
}

function isPdfAttachment({
	name,
	type,
}: {
	name: string;
	type: string;
}) {
	return type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
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

function studentQuizQuestionsFromRecord(
	record: StoredTeacherCaseRecord,
): StudentCaseQuizQuestion[] {
	return storedQuizQuestionsFromRecord(record).map((question) => ({
		options: question.options,
		prompt: question.prompt,
		questionId: question.questionId,
	}));
}

function storedQuizQuestionsFromRecord(
	record: StoredTeacherCaseRecord,
): StoredStudentCaseQuizQuestion[] {
	const questions = Array.isArray(record.draft?.cmeQuestions)
		? record.draft.cmeQuestions
		: [];

	return questions.flatMap((question) => {
		const parsed = quizQuestionFromUnknown(question);

		return parsed ? [parsed] : [];
	});
}

function quizQuestionFromUnknown(
	value: unknown,
): StoredStudentCaseQuizQuestion | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	const questionId = stringFromUnknown(candidate.id).trim();
	const prompt = stringFromUnknown(candidate.prompt).trim();
	const correctOptionId = stringFromUnknown(candidate.correctOptionId).trim();
	const options = Array.isArray(candidate.options)
		? candidate.options.flatMap((option) => {
				const parsed = quizOptionFromUnknown(option);

				return parsed ? [parsed] : [];
			})
		: [];

	if (
		!questionId ||
		!prompt ||
		options.length < 2 ||
		options.length > 5 ||
		!options.some((option) => option.optionId === correctOptionId)
	) {
		return null;
	}

	return {
		correctOptionId,
		options,
		prompt,
		questionId,
	};
}

function quizOptionFromUnknown(value: unknown): StudentCaseQuizOption | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	const optionId = stringFromUnknown(candidate.id).trim();
	const text = stringFromUnknown(candidate.text).trim();

	if (!optionId || !text) {
		return null;
	}

	return {
		optionId,
		text,
	};
}

function isPassingStudentCaseQuiz(
	questions: StoredStudentCaseQuizQuestion[],
	answers: Record<string, string>,
) {
	return questions.every(
		(question) => answers[question.questionId] === question.correctOptionId,
	);
}

function studentCaseCertificateId({
	caseId,
	studentProfileId,
}: {
	caseId: string;
	studentProfileId: string;
}) {
	const digest = createHash("sha256")
		.update(`${studentProfileId}\n${caseId}`)
		.digest("base64url")
		.slice(0, 32);

	return `cert_${digest}`;
}

function isConditionalWriteFailure(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const errorName =
		"name" in error && typeof error.name === "string" ? error.name : null;

	if (errorName === "ConditionalCheckFailedException") {
		return true;
	}

	if (errorName !== "TransactionCanceledException") {
		return false;
	}

	if (!("CancellationReasons" in error)) {
		return true;
	}

	const reasons = error.CancellationReasons;

	return (
		Array.isArray(reasons) &&
		reasons.some(
			(reason) =>
				typeof reason === "object" &&
				reason !== null &&
				"Code" in reason &&
				reason.Code === "ConditionalCheckFailed",
		)
	);
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
