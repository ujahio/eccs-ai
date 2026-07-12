export type StudentCaseQuizFormStatus =
	| "idle"
	| "failed"
	| "passed"
	| "review_required"
	| "expired"
	| "duplicate"
	| "error";

export type StudentCaseQuizFormState = {
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

export const initialStudentCaseQuizFormState: StudentCaseQuizFormState = {
	message: "",
	status: "idle",
};
