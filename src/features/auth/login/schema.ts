import {
	failedPasswordRequirements,
	normalizeEmail,
	passwordRequirementMessage,
} from "../registration/schema";

export type LoginInput = {
	email: string;
	password: string;
};

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

export type CompleteNewPasswordInput = {
	email: string;
	password: string;
	confirmPassword: string;
	challengeSession: string;
};

export type CompleteNewPasswordFieldErrors = Partial<
	Record<"password" | "confirmPassword", string>
>;

export type ParsedLoginInput =
	| {
			success: true;
			data: LoginInput & { emailNormalized: string };
	  }
	| {
			success: false;
			fieldErrors: LoginFieldErrors;
	  };

export type ParsedCompleteNewPasswordInput =
	| {
			success: true;
			data: CompleteNewPasswordInput & { emailNormalized: string };
	  }
	| {
			success: false;
			fieldErrors: CompleteNewPasswordFieldErrors;
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

export function parseCompleteNewPasswordInput(
	input: CompleteNewPasswordInput
): ParsedCompleteNewPasswordInput {
	const password = input.password;
	const confirmPassword = input.confirmPassword;
	const challengeSession = input.challengeSession.trim();
	const fieldErrors: CompleteNewPasswordFieldErrors = {};
	const missingPasswordRequirements = failedPasswordRequirements(password);

	if (missingPasswordRequirements.length > 0) {
		fieldErrors.password = passwordRequirementMessage(
			missingPasswordRequirements
		);
	}

	if (!confirmPassword) {
		fieldErrors.confirmPassword = "Confirm your new password.";
	} else if (password && password !== confirmPassword) {
		fieldErrors.confirmPassword = "Passwords do not match.";
	}

	if (!challengeSession) {
		fieldErrors.password = "Start sign-in again before setting your password.";
	}

	if (Object.keys(fieldErrors).length > 0) {
		return { success: false, fieldErrors };
	}

	return {
		success: true,
		data: {
			email: input.email.trim(),
			emailNormalized: normalizeEmail(input.email),
			password,
			confirmPassword,
			challengeSession,
		},
	};
}
