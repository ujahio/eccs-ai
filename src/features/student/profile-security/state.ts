export type StudentPersonalDetailsField = "firstName" | "lastName" | "email";
export type StudentPasswordChangeField =
	| "currentPassword"
	| "password"
	| "confirmPassword";

type FormStatus = "idle" | "error" | "success" | "notice";

export type StudentPersonalDetailsFormState = {
	status: FormStatus;
	message: string;
	values: Record<StudentPersonalDetailsField, string>;
	errors: Partial<Record<StudentPersonalDetailsField, string[]>>;
};

export type StudentPasswordChangeFormState = {
	status: FormStatus;
	message: string;
	values: Record<StudentPasswordChangeField, string>;
	errors: Partial<Record<StudentPasswordChangeField, string[]>>;
};

export function initialStudentPersonalDetailsFormState(values: {
	firstName: string;
	lastName: string;
	email: string;
}): StudentPersonalDetailsFormState {
	return {
		status: "idle",
		message: "",
		values,
		errors: {},
	};
}

export const initialStudentPasswordChangeFormState: StudentPasswordChangeFormState =
	{
		status: "idle",
		message: "",
		values: {
			currentPassword: "",
			password: "",
			confirmPassword: "",
		},
		errors: {},
	};
