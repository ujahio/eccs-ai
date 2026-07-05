export type PasswordResetRequestField = "email";

export type PasswordResetConfirmField =
	| "email"
	| "code"
	| "password"
	| "confirmPassword";

export type PasswordResetRequestFormState = {
	status: "idle" | "error" | "success" | "notice";
	message: string;
	values: Record<PasswordResetRequestField, string>;
	errors: Partial<Record<PasswordResetRequestField, string[]>>;
};

export type PasswordResetConfirmFormState = {
	status: "idle" | "error" | "success" | "notice";
	message: string;
	values: Record<PasswordResetConfirmField, string>;
	errors: Partial<Record<PasswordResetConfirmField, string[]>>;
};

export const initialPasswordResetRequestFormState: PasswordResetRequestFormState =
	{
		status: "idle",
		message: "",
		values: {
			email: ""
		},
		errors: {}
	};

export function initialPasswordResetConfirmFormState(
	code = ""
): PasswordResetConfirmFormState {
	return {
		status: "idle",
		message: "",
		values: {
			email: "",
			code,
			password: "",
			confirmPassword: ""
		},
		errors: {}
	};
}
