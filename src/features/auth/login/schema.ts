import { normalizeEmail } from "../registration/schema";

export type LoginInput = {
	email: string;
	password: string;
};

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

export type ParsedLoginInput =
	| {
			success: true;
			data: LoginInput & { emailNormalized: string };
	  }
	| {
			success: false;
			fieldErrors: LoginFieldErrors;
	  };

export function parseLoginInput(input: LoginInput): ParsedLoginInput {
	const email = input.email.trim();
	const password = input.password;
	const fieldErrors: LoginFieldErrors = {};

	if (!email) {
		fieldErrors.email = "Enter your email address.";
	}

	if (!password) {
		fieldErrors.password = "Enter your password.";
	}

	if (Object.keys(fieldErrors).length > 0) {
		return { success: false, fieldErrors };
	}

	return {
		success: true,
		data: {
			email,
			emailNormalized: normalizeEmail(email),
			password
		}
	};
}

export function loginInputFromFormData(formData: FormData): LoginInput {
	return {
		email: String(formData.get("email") ?? ""),
		password: String(formData.get("password") ?? "")
	};
}
