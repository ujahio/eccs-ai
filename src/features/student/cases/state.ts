export type StudentCaseQuizFormStatus =
	| "idle"
	| "failed"
	| "passed"
	| "expired"
	| "duplicate"
	| "error";

export type StudentCaseQuizFormState = {
	certificateId?: string;
	message: string;
	status: StudentCaseQuizFormStatus;
	submittedAt?: number;
};

export type StudentCaseQuizAction = (
	previousState: StudentCaseQuizFormState,
	formData: FormData,
) => Promise<StudentCaseQuizFormState>;

export const initialStudentCaseQuizFormState: StudentCaseQuizFormState = {
	message: "",
	status: "idle",
};
