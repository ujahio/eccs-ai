export type StudentCaseQuizFormStatus =
	| "idle"
	| "failed"
	| "passed"
	| "review_required"
	| "expired"
	| "duplicate"
	| "error";

export type StudentCaseQuizCertificateState = {
	certificateBranding: {
		organizationName: string;
		shortName: string;
	};
	caseTitle: string;
	completedAt: number;
	studentDisplayName: string;
};

export type StudentCaseQuizFormState = {
	certificate?: StudentCaseQuizCertificateState;
	certificateId?: string;
	failuresSinceReview?: number;
	message: string;
	reviewRequired?: boolean;
	status: StudentCaseQuizFormStatus;
	submittedAt?: number;
};

export type StudentCaseQuizAction = (
	previousState: StudentCaseQuizFormState,
	formData: FormData,
) => Promise<StudentCaseQuizFormState>;

export type StudentCaseQuizReviewFormStatus = "ready" | "expired" | "error";

export type StudentCaseQuizReviewFormState = {
	message: string;
	status: StudentCaseQuizReviewFormStatus;
	submittedAt?: number;
};

export type StudentCaseQuizReviewAction = (
	formData: FormData,
) => Promise<StudentCaseQuizReviewFormState>;

export type StudentCaseFeedbackFormStatus = "idle" | "submitted" | "error";

export type StudentCaseFeedbackFormState = {
	message: string;
	status: StudentCaseFeedbackFormStatus;
	submittedAt?: number;
};

export type StudentCaseFeedbackAction = (
	formData: FormData,
) => Promise<StudentCaseFeedbackFormState>;

export const initialStudentCaseQuizFormState: StudentCaseQuizFormState = {
	message: "",
	status: "idle",
};

export const initialStudentCaseFeedbackFormState: StudentCaseFeedbackFormState =
	{
		message: "",
		status: "idle",
	};
