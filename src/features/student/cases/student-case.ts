import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	TransactWriteCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { awsClientConfig } from "@/lib/aws/client-config";
import { getSessionAuthResources } from "@/lib/aws/resources";
import {
	getE2EAuthStore,
	getE2ETeacherCaseStore,
	isE2EMode,
	saveE2EStudentCaseCompletion,
	saveE2EStudentCertificate,
} from "@/lib/e2e/in-memory-auth";
import {
	hasStudentCaseFeedbackValues,
	type StudentCaseFeedback,
	type StudentCaseFeedbackInput,
	validateStudentCaseFeedbackInput,
} from "@/features/case-feedback/feedback";
import { validateAnalysisWordCount } from "./analysis";
import {
	studentCaseCertificateId,
	studentCaseCompletionId,
	studentCaseQuizAttemptId,
} from "@/features/student-case-records/ids";

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
	personalAnalysis: string;
	studentDisplayName: string;
	studentProfileId: string;
};

export type CompleteStudentCaseQuizResult =
	| {
			certificate: {
				certificateBranding: StudentCaseCertificateBranding;
				caseTitle: string;
				completedAt: number;
				studentDisplayName: string;
			};
			certificateId: string;
			status: "passed";
	  }
	| {
			failuresSinceReview: number;
			reviewRequired: boolean;
			status: "failed";
	  };

export type CompleteStudentCaseQuizReviewArgs = {
	caseId: string;
	studentProfileId: string;
};

export type SubmitStudentCaseFeedbackArgs = {
	caseId: string;
	feedback: StudentCaseFeedbackInput;
	studentProfileId: string;
};

export type SubmitStudentCaseFeedbackResult = {
	status: "already_submitted" | "skipped" | "submitted";
};

export type StudentCaseCertificateRecord = {
	certificateBranding: StudentCaseCertificateBranding;
	certificateId: string;
	caseId: string;
	caseTitle: string;
	completedAt: number;
	recordType: typeof studentCaseCertificateRecordType;
	studentDisplayName: string;
	studentProfileId: string;
};

export type StudentCaseCertificateBranding = {
	organizationName: "E-Clinical Case Solutions";
	shortName: "ECCS";
};

export type StudentCaseCompletionRecord = {
	analysisLockedAt: number;
	analysisSubmittedAt: number;
	caseId: string;
	certificateId: string;
	completedAt: number;
	completionId: string;
	feedback?: StudentCaseFeedback;
	personalAnalysis: string;
	recordType: typeof studentCaseCompletionRecordType;
	studentDisplayName: string;
	studentProfileId: string;
};

type StudentCaseRepository = {
	completeStudentCaseQuizReview(
		args: CompleteStudentCaseQuizReviewArgs,
		now: number,
	): Promise<void>;
	createStudentCaseCertificate(
		record: StudentCaseCertificateRecord,
		completionRecord: StudentCaseCompletionRecord,
		now: number,
	): Promise<void>;
	getStudentCaseQuizAttempt(
		args: CompleteStudentCaseQuizReviewArgs,
	): Promise<StudentCaseQuizAttemptState>;
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
	recordFailedStudentCaseQuizAttempt(
		args: CompleteStudentCaseQuizReviewArgs,
		now: number,
	): Promise<StudentCaseQuizAttemptState>;
	submitStudentCaseFeedback(
		args: {
			caseId: string;
			feedback: StudentCaseFeedback;
			studentProfileId: string;
		},
	): Promise<SubmitStudentCaseFeedbackResult>;
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

type StudentCaseQuizAttemptState = {
	failuresSinceReview: number;
	reviewRequired: boolean;
};

const attachmentUrlTtlMilliseconds = 15 * 60 * 1_000;
const studentCaseCertificateRecordType = "studentCaseCertificate";
const studentCaseCompletionRecordType = "studentCaseCompletion";
const eccsCertificateBranding: StudentCaseCertificateBranding = {
	organizationName: "E-Clinical Case Solutions",
	shortName: "ECCS",
};

export async function getStudentActiveCasePresentation(caseId: string) {
	return getStudentCaseRepository().getActiveCasePresentation(caseId, Date.now());
}

export async function completeStudentCaseQuiz({
	answers,
	caseId,
	personalAnalysis,
	studentDisplayName,
	studentProfileId,
}: CompleteStudentCaseQuizArgs): Promise<CompleteStudentCaseQuizResult> {
	const repository = getStudentCaseRepository();
	const now = Date.now();
	const caseRecord = await repository.getActiveCaseQuiz(caseId, now);

	if (!caseRecord) {
		throw new StudentCaseExpiredError();
	}

	const attemptState = await repository.getStudentCaseQuizAttempt({
		caseId,
		studentProfileId,
	});

	if (attemptState.reviewRequired) {
		throw new StudentCaseQuizReviewRequiredError();
	}

	if (!isPassingStudentCaseQuiz(caseRecord.questions, answers)) {
		return {
			status: "failed",
			...(await repository.recordFailedStudentCaseQuizAttempt(
				{
					caseId,
					studentProfileId,
				},
				now,
			)),
		};
	}

	const lockedPersonalAnalysis = personalAnalysisForCompletion(personalAnalysis);
	const certificateId = studentCaseCertificateId({
		caseId,
		studentProfileId,
	});
	const completionId = studentCaseCompletionId({
		caseId,
		studentProfileId,
	});

	await repository.createStudentCaseCertificate(
		{
			certificateBranding: eccsCertificateBranding,
			certificateId,
			caseId,
			caseTitle: caseRecord.title,
			completedAt: now,
			recordType: studentCaseCertificateRecordType,
			studentDisplayName,
			studentProfileId,
		},
		{
			analysisLockedAt: now,
			analysisSubmittedAt: now,
			caseId,
			certificateId,
			completedAt: now,
			completionId,
			personalAnalysis: lockedPersonalAnalysis,
			recordType: studentCaseCompletionRecordType,
			studentDisplayName,
			studentProfileId,
		},
		now,
	);

	return {
		certificate: {
			certificateBranding: eccsCertificateBranding,
			caseTitle: caseRecord.title,
			completedAt: now,
			studentDisplayName,
		},
		certificateId,
		status: "passed",
	};
}

export async function completeStudentCaseQuizReview({
	caseId,
	studentProfileId,
}: CompleteStudentCaseQuizReviewArgs) {
	const repository = getStudentCaseRepository();
	const now = Date.now();
	const caseRecord = await repository.getActiveCaseQuiz(caseId, now);

	if (!caseRecord) {
		throw new StudentCaseExpiredError();
	}

	await repository.completeStudentCaseQuizReview(
		{
			caseId,
			studentProfileId,
		},
		now,
	);
}

export async function submitStudentCaseFeedback({
	caseId,
	feedback,
	studentProfileId,
}: SubmitStudentCaseFeedbackArgs): Promise<SubmitStudentCaseFeedbackResult> {
	const repository = getStudentCaseRepository();
	const now = Date.now();
	const validatedFeedback = validateStudentCaseFeedbackInput(feedback);

	if (!hasStudentCaseFeedbackValues(validatedFeedback)) {
		return { status: "skipped" };
	}

	return repository.submitStudentCaseFeedback(
		{
			caseId,
			feedback: {
				...validatedFeedback,
				submittedAt: now,
			},
			studentProfileId,
		},
	);
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
		resources.studentCaseCompletionTableName,
		resources.studentQuizAttemptTableName,
	);
}

export class InMemoryStudentCaseRepository implements StudentCaseRepository {
	async completeStudentCaseQuizReview(
		args: CompleteStudentCaseQuizReviewArgs,
		now: number,
	) {
		const store = getE2EAuthStore();
		const attemptId = studentCaseQuizAttemptId(args);
		const record = store.studentQuizAttempts.get(attemptId);

		if (!record?.reviewRequired) {
			return;
		}

		store.studentQuizAttempts.set(attemptId, {
			...record,
			failuresSinceReview: 0,
			reviewRequired: false,
			updatedAt: now,
		});
	}

	async createStudentCaseCertificate(
		record: StudentCaseCertificateRecord,
		completionRecord: StudentCaseCompletionRecord,
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

		const attemptState = quizAttemptStateFromRecord(
			store.studentQuizAttempts.get(studentCaseQuizAttemptId(record)) ?? null,
		);

		if (attemptState.reviewRequired) {
			throw new StudentCaseQuizReviewRequiredError();
		}

		saveE2EStudentCertificate(record);
		saveE2EStudentCaseCompletion(completionRecord);
		store.studentQuizAttempts.delete(studentCaseQuizAttemptId(record));
		store.teacherCases.set(record.caseId, {
			...caseRecord,
			completionCount: caseRecord.completionCount + 1,
		});
	}

	async getStudentCaseQuizAttempt(args: CompleteStudentCaseQuizReviewArgs) {
		return quizAttemptStateFromRecord(
			getE2EAuthStore().studentQuizAttempts.get(
				studentCaseQuizAttemptId(args),
			) ?? null,
		);
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

	async recordFailedStudentCaseQuizAttempt(
		args: CompleteStudentCaseQuizReviewArgs,
		now: number,
	) {
		const store = getE2EAuthStore();
		const attemptId = studentCaseQuizAttemptId(args);
		const currentState = quizAttemptStateFromRecord(
			store.studentQuizAttempts.get(attemptId) ?? null,
		);

		if (currentState.reviewRequired) {
			throw new StudentCaseQuizReviewRequiredError();
		}

		const nextFailuresSinceReview = currentState.failuresSinceReview + 1;
		const reviewRequired = nextFailuresSinceReview >= 3;
		const nextState = {
			attemptId,
			caseId: args.caseId,
			failuresSinceReview: reviewRequired ? 0 : nextFailuresSinceReview,
			reviewRequired,
			studentProfileId: args.studentProfileId,
			updatedAt: now,
		};

		store.studentQuizAttempts.set(attemptId, nextState);

		return {
			failuresSinceReview: nextState.failuresSinceReview,
			reviewRequired,
		};
	}

	async submitStudentCaseFeedback(
		args: {
			caseId: string;
			feedback: StudentCaseFeedback;
			studentProfileId: string;
		},
	) {
		const store = getE2EAuthStore();
		const completionId = studentCaseCompletionId(args);
		const completion = store.studentCaseCompletions.get(completionId);

		if (!completion) {
			throw new StudentCaseFeedbackUnavailableError();
		}

		if (completion.feedback) {
			return { status: "already_submitted" as const };
		}

		store.studentCaseCompletions.set(completionId, {
			...completion,
			feedback: args.feedback,
		});

		const caseRecord = store.teacherCases.get(args.caseId);

		if (caseRecord) {
			store.teacherCases.set(args.caseId, {
				...caseRecord,
				feedbackCount: caseRecord.feedbackCount + 1,
			});
		}

		return { status: "submitted" as const };
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
	private readonly studentCaseCompletionTableName: string;
	private readonly studentCertificateTableName: string;
	private readonly studentQuizAttemptTableName: string;

	constructor(
		private readonly teacherCaseTableName: string,
		studentCertificateTableName: string,
		studentCaseCompletionTableName: string,
		studentQuizAttemptTableName: string,
		documentClient = DynamoDBDocumentClient.from(
			new DynamoDBClient(awsClientConfig()),
		),
	) {
		this.studentCaseCompletionTableName = studentCaseCompletionTableName;
		this.studentCertificateTableName = studentCertificateTableName;
		this.studentQuizAttemptTableName = studentQuizAttemptTableName;
		this.documentClient = documentClient;
	}

	async completeStudentCaseQuizReview(
		args: CompleteStudentCaseQuizReviewArgs,
		now: number,
	) {
		try {
			await this.documentClient.send(
				new UpdateCommand({
					TableName: this.studentQuizAttemptTableName,
					Key: { attemptId: studentCaseQuizAttemptId(args) },
					UpdateExpression:
						"SET failuresSinceReview = :zero, reviewRequired = :false, updatedAt = :now",
					ConditionExpression: "reviewRequired = :true",
					ExpressionAttributeValues: {
						":false": false,
						":now": now,
						":true": true,
						":zero": 0,
					},
				}),
			);
		} catch (error) {
			if (!isConditionalWriteFailure(error)) {
				throw error;
			}
		}
	}

	async createStudentCaseCertificate(
		record: StudentCaseCertificateRecord,
		completionRecord: StudentCaseCompletionRecord,
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
							Put: {
								TableName: this.studentCaseCompletionTableName,
								Item: completionRecord,
								ConditionExpression: "attribute_not_exists(completionId)",
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
						{
							Delete: {
								TableName: this.studentQuizAttemptTableName,
								Key: { attemptId: studentCaseQuizAttemptId(record) },
								ConditionExpression:
									"attribute_not_exists(attemptId) OR reviewRequired = :false",
								ExpressionAttributeValues: {
									":false": false,
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

			if (await this.hasQuizReviewRequired(record)) {
				throw new StudentCaseQuizReviewRequiredError();
			}

			throw new StudentCaseExpiredError();
		}
	}

	async getStudentCaseQuizAttempt(args: CompleteStudentCaseQuizReviewArgs) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.studentQuizAttemptTableName,
				Key: { attemptId: studentCaseQuizAttemptId(args) },
			}),
		);

		return quizAttemptStateFromRecord(response.Item ?? null);
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

	async recordFailedStudentCaseQuizAttempt(
		args: CompleteStudentCaseQuizReviewArgs,
		now: number,
	) {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const response = await this.documentClient.send(
				new GetCommand({
					TableName: this.studentQuizAttemptTableName,
					Key: { attemptId: studentCaseQuizAttemptId(args) },
				}),
			);
			const currentRecord = response.Item ?? null;
			const currentState = quizAttemptStateFromRecord(currentRecord);

			if (currentState.reviewRequired) {
				throw new StudentCaseQuizReviewRequiredError();
			}

			const nextFailuresSinceReview = currentState.failuresSinceReview + 1;
			const nextState = {
				failuresSinceReview:
					nextFailuresSinceReview >= 3 ? 0 : nextFailuresSinceReview,
				reviewRequired: nextFailuresSinceReview >= 3,
			};
			const conditionExpression =
				currentRecord === null
					? "attribute_not_exists(attemptId)"
					: "reviewRequired = :false AND failuresSinceReview = :currentFailuresSinceReview";
			const conditionValues =
				currentRecord === null
					? {}
					: {
							":currentFailuresSinceReview":
								currentState.failuresSinceReview,
							":false": false,
						};

			try {
				await this.documentClient.send(
					new UpdateCommand({
						TableName: this.studentQuizAttemptTableName,
						Key: { attemptId: studentCaseQuizAttemptId(args) },
						UpdateExpression:
							"SET caseId = :caseId, studentProfileId = :studentProfileId, updatedAt = :now, failuresSinceReview = :failuresSinceReview, reviewRequired = :reviewRequired",
						ConditionExpression: conditionExpression,
						ExpressionAttributeValues: {
							":caseId": args.caseId,
							":failuresSinceReview": nextState.failuresSinceReview,
							":now": now,
							":reviewRequired": nextState.reviewRequired,
							":studentProfileId": args.studentProfileId,
							...conditionValues,
						},
					}),
				);

				return nextState;
			} catch (error) {
				if (isConditionalWriteFailure(error)) {
					continue;
				}

				throw error;
			}
		}

		throw new StudentCaseQuizReviewRequiredError();
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

	async submitStudentCaseFeedback(
		args: {
			caseId: string;
			feedback: StudentCaseFeedback;
			studentProfileId: string;
		},
	) {
		try {
			await this.documentClient.send(
				new TransactWriteCommand({
					TransactItems: [
						{
							Update: {
								TableName: this.studentCaseCompletionTableName,
								Key: { completionId: studentCaseCompletionId(args) },
								UpdateExpression: "SET #feedback = :feedback",
								ConditionExpression:
									"attribute_exists(completionId) AND attribute_not_exists(#feedback)",
								ExpressionAttributeNames: {
									"#feedback": "feedback",
								},
								ExpressionAttributeValues: {
									":feedback": args.feedback,
								},
							},
						},
						{
							Update: {
								TableName: this.teacherCaseTableName,
								Key: { caseId: args.caseId },
								UpdateExpression:
									"SET feedbackCount = if_not_exists(feedbackCount, :zero) + :one",
								ConditionExpression: "attribute_exists(caseId)",
								ExpressionAttributeValues: {
									":one": 1,
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

			const completion = await this.getStudentCaseCompletion(args);

			if (!completion) {
				throw new StudentCaseFeedbackUnavailableError();
			}

			if (hasStudentCaseFeedback(completion)) {
				return { status: "already_submitted" as const };
			}

			throw new StudentCaseFeedbackUnavailableError();
		}

		return { status: "submitted" as const };
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

	private async hasQuizReviewRequired(args: CompleteStudentCaseQuizReviewArgs) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.studentQuizAttemptTableName,
				Key: { attemptId: studentCaseQuizAttemptId(args) },
			}),
		);

		return quizAttemptStateFromRecord(response.Item ?? null).reviewRequired;
	}

	private async getStudentCaseCompletion(args: {
		caseId: string;
		studentProfileId: string;
	}) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.studentCaseCompletionTableName,
				Key: { completionId: studentCaseCompletionId(args) },
			}),
		);

		return response.Item ?? null;
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

export class StudentCaseQuizReviewRequiredError extends Error {
	constructor() {
		super("Review required before retrying this quiz.");
		this.name = "StudentCaseQuizReviewRequiredError";
	}
}

export class StudentCaseAnalysisRequiredError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "StudentCaseAnalysisRequiredError";
	}
}

export class StudentCaseFeedbackUnavailableError extends Error {
	constructor() {
		super("Complete the quiz before submitting feedback.");
		this.name = "StudentCaseFeedbackUnavailableError";
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

function personalAnalysisForCompletion(personalAnalysis: string) {
	const trimmedAnalysis = personalAnalysis.trim();
	const validation = validateAnalysisWordCount(trimmedAnalysis);

	if (!validation.valid) {
		throw new StudentCaseAnalysisRequiredError(validation.message);
	}

	return trimmedAnalysis;
}

function quizAttemptStateFromRecord(
	record: unknown,
): StudentCaseQuizAttemptState {
	if (typeof record !== "object" || record === null) {
		return {
			failuresSinceReview: 0,
			reviewRequired: false,
		};
	}

	const candidate = record as Partial<StudentCaseQuizAttemptState>;
	const failuresSinceReview = numberFromUnknown(candidate.failuresSinceReview);

	return {
		failuresSinceReview:
			failuresSinceReview > 0 && Number.isFinite(failuresSinceReview)
				? failuresSinceReview
				: 0,
		reviewRequired: candidate.reviewRequired === true,
	};
}

function hasStudentCaseFeedback(record: unknown) {
	return (
		typeof record === "object" &&
		record !== null &&
		"feedback" in record &&
		(record as { feedback?: unknown }).feedback !== undefined
	);
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
