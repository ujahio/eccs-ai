"use server";

import { revalidatePath } from "next/cache";
import {
	completeStudentCaseQuizReview,
	completeStudentCaseQuiz,
	DuplicateStudentCaseCertificateError,
	StudentCaseAnalysisRequiredError,
	StudentCaseExpiredError,
	StudentCaseFeedbackUnavailableError,
	StudentCaseQuizReviewRequiredError,
	submitStudentCaseFeedback,
} from "@/features/student/cases/student-case";
import type {
	StudentCaseFeedbackFormState,
	StudentCaseQuizFormState,
	StudentCaseQuizReviewFormState,
} from "@/features/student/cases/state";
import {
	StudentCaseFeedbackValidationError,
	studentCaseFeedbackRatingQuestions,
	type StudentCaseFeedbackRatingKey,
} from "@/features/case-feedback/feedback";
import { requireStudentSession } from "@/lib/auth/session";

export async function submitStudentCaseQuizForm(
	_state: StudentCaseQuizFormState,
	formData: FormData,
): Promise<StudentCaseQuizFormState> {
	const { profile } = await requireStudentSession();
	const caseId = stringFromFormData(formData.get("caseId"));

	if (!caseId) {
		return {
			message: "Unable to submit this quiz. Return to your dashboard and retry.",
			status: "error",
			submittedAt: Date.now(),
		};
	}

	const answers = quizAnswersFromFormData(formData);

	try {
		const result = await completeStudentCaseQuiz({
			answers,
			caseId,
			personalAnalysis: personalAnalysisFromFormData(formData),
			studentDisplayName: profile.fullName,
			studentProfileId: profile.profileId,
		});

		if (result.status === "failed") {
			if (result.reviewRequired) {
				return {
					failuresSinceReview: result.failuresSinceReview,
					message: "Quiz attempt submitted. Result: did not pass.",
					reviewRequired: true,
					status: "review_required",
					submittedAt: Date.now(),
				};
			}

			return {
				failuresSinceReview: result.failuresSinceReview,
				message: "Quiz attempt submitted. Result: did not pass.",
				reviewRequired: false,
				status: "failed",
				submittedAt: Date.now(),
			};
		}

		revalidatePath("/student");
		revalidatePath("/student/certificates");

		return {
			certificate: result.certificate,
			certificateId: result.certificateId,
			message: "Quiz passed. Your certificate is ready.",
			status: "passed",
			submittedAt: Date.now(),
		};
	} catch (error) {
		if (error instanceof StudentCaseExpiredError) {
			return {
				message:
					"This case is no longer active. Return to your dashboard for the current case status.",
				status: "expired",
				submittedAt: Date.now(),
			};
		}

		if (error instanceof DuplicateStudentCaseCertificateError) {
			return {
				message:
					"A certificate has already been earned for this case. Duplicate submissions are rejected.",
				status: "duplicate",
				submittedAt: Date.now(),
			};
		}

		if (error instanceof StudentCaseQuizReviewRequiredError) {
			return {
				message: "Quiz attempt submitted. Result: did not pass.",
				reviewRequired: true,
				status: "review_required",
				submittedAt: Date.now(),
			};
		}

		if (error instanceof StudentCaseAnalysisRequiredError) {
			return {
				message: error.message,
				status: "error",
				submittedAt: Date.now(),
			};
		}

		return {
			message: "Unable to submit this quiz right now. Please try again.",
			status: "error",
			submittedAt: Date.now(),
		};
	}
}

export async function completeStudentCaseQuizReviewForm(
	formData: FormData,
): Promise<StudentCaseQuizReviewFormState> {
	const { profile } = await requireStudentSession();
	const caseId = stringFromFormData(formData.get("caseId"));

	if (!caseId) {
		return {
			message: "Unable to continue to this quiz. Return to your dashboard and retry.",
			status: "error",
			submittedAt: Date.now(),
		};
	}

	try {
		await completeStudentCaseQuizReview({
			caseId,
			studentProfileId: profile.profileId,
		});

		return {
			message: "",
			status: "ready",
			submittedAt: Date.now(),
		};
	} catch (error) {
		if (error instanceof StudentCaseExpiredError) {
			return {
				message:
					"This case is no longer active. Return to your dashboard for the current case status.",
				status: "expired",
				submittedAt: Date.now(),
			};
		}

		return {
			message: "Unable to continue to this quiz right now. Please try again.",
			status: "error",
			submittedAt: Date.now(),
		};
	}
}

export async function submitStudentCaseFeedbackForm(
	formData: FormData,
): Promise<StudentCaseFeedbackFormState> {
	const { profile } = await requireStudentSession();
	const caseId = stringFromFormData(formData.get("caseId"));

	if (!caseId) {
		return {
			message:
				"Unable to submit feedback. Return to your dashboard and retry.",
			status: "error",
			submittedAt: Date.now(),
		};
	}

	try {
		await submitStudentCaseFeedback({
			caseId,
			feedback: {
				futureSuggestions: stringFromFormData(
					formData.get("futureSuggestions"),
				),
				ratings: feedbackRatingsFromFormData(formData),
			},
			studentProfileId: profile.profileId,
		});

		revalidatePath("/teacher");
		revalidatePath("/teacher/cases");

		return {
			message: "Thank you for sharing feedback.",
			status: "submitted",
			submittedAt: Date.now(),
		};
	} catch (error) {
		if (error instanceof StudentCaseFeedbackValidationError) {
			return {
				message: error.message,
				status: "error",
				submittedAt: Date.now(),
			};
		}

		if (error instanceof StudentCaseFeedbackUnavailableError) {
			return {
				message: error.message,
				status: "error",
				submittedAt: Date.now(),
			};
		}

		return {
			message: "Unable to submit feedback right now. Please try again.",
			status: "error",
			submittedAt: Date.now(),
		};
	}
}

function quizAnswersFromFormData(formData: FormData) {
	const answers: Record<string, string> = {};

	for (const [key, value] of formData.entries()) {
		if (!key.startsWith("answer:")) {
			continue;
		}

		const questionId = key.slice("answer:".length).trim();
		const optionId = stringFromFormData(value);

		if (questionId && optionId) {
			answers[questionId] = optionId;
		}
	}

	return answers;
}

function personalAnalysisFromFormData(formData: FormData) {
	return stringFromFormData(formData.get("personalAnalysis"));
}

function feedbackRatingsFromFormData(formData: FormData) {
	const ratings: Partial<Record<StudentCaseFeedbackRatingKey, number>> = {};

	for (const question of studentCaseFeedbackRatingQuestions) {
		const value = Number(formData.get(`feedback:${question.id}`));

		if (Number.isFinite(value)) {
			ratings[question.id] = value;
		}
	}

	return ratings;
}

function stringFromFormData(value: FormDataEntryValue | null) {
	return typeof value === "string" ? value.trim() : "";
}
