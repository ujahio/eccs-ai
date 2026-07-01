export type RegistrationField = "firstName" | "lastName" | "email" | "password";

export type RegistrationFormValues = Record<RegistrationField, string>;

export type RegistrationFormState = {
	status: "idle" | "error" | "success" | "notice";
	message: string;
	values: RegistrationFormValues;
	errors: Partial<Record<RegistrationField, string[]>>;
};

export type RegistrationAction = (
	previousState: RegistrationFormState,
	formData: FormData
) => Promise<RegistrationFormState>;

export const initialRegistrationFormState: RegistrationFormState = {
	status: "idle",
	message: "",
	values: {
		firstName: "",
		lastName: "",
		email: "",
		password: ""
	},
	errors: {}
};
