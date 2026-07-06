export type ProfileSecurityPersonalDetailsField = "firstName" | "lastName" | "email";
export type ProfileSecurityPasswordChangeField =
	| "currentPassword"
	| "password"
	| "confirmPassword";

type FormStatus = "idle" | "error" | "success" | "notice";

export type ProfileSecurityPersonalDetailsFormState = {
	status: FormStatus;
	message: string;
	values: Record<ProfileSecurityPersonalDetailsField, string>;
	errors: Partial<Record<ProfileSecurityPersonalDetailsField, string[]>>;
};

export type ProfileSecurityPasswordChangeFormState = {
	status: FormStatus;
	message: string;
	values: Record<ProfileSecurityPasswordChangeField, string>;
	errors: Partial<Record<ProfileSecurityPasswordChangeField, string[]>>;
};

export function initialProfileSecurityPersonalDetailsFormState(values: {
	firstName: string;
	lastName: string;
	email: string;
}): ProfileSecurityPersonalDetailsFormState {
	return {
		status: "idle",
		message: "",
		values,
		errors: {},
	};
}

export const initialProfileSecurityPasswordChangeFormState: ProfileSecurityPasswordChangeFormState =
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
