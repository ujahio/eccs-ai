export type LoginField = "email" | "password";

export type LoginFormValues = Record<LoginField, string>;

export type LoginFormState = {
	status: "idle" | "error" | "blocked" | "success";
	message: string;
	values: LoginFormValues;
	errors: Partial<Record<LoginField, string[]>>;
};

export type LoginAction = (
	previousState: LoginFormState,
	formData: FormData
) => Promise<LoginFormState>;

export const initialLoginFormState: LoginFormState = {
	status: "idle",
	message: "",
	values: {
		email: "",
		password: ""
	},
	errors: {}
};
