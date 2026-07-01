export type RegistrationInput = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
};

export type RegistrationFieldErrors = Partial<
	Record<keyof RegistrationInput, string>
>;

export type ParsedRegistrationInput =
	| {
			success: true;
			data: RegistrationInput & { emailNormalized: string };
	  }
	| {
			success: false;
			fieldErrors: RegistrationFieldErrors;
	  };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export function parseRegistrationInput(
	input: RegistrationInput
): ParsedRegistrationInput {
	const firstName = input.firstName.trim();
	const lastName = input.lastName.trim();
	const email = input.email.trim();
	const emailNormalized = normalizeEmail(email);
	const password = input.password;
	const fieldErrors: RegistrationFieldErrors = {};

	if (!firstName) {
		fieldErrors.firstName = "Enter your first name.";
	} else if (firstName.length > 80) {
		fieldErrors.firstName = "First name must be 80 characters or fewer.";
	}

	if (!lastName) {
		fieldErrors.lastName = "Enter your last name.";
	} else if (lastName.length > 80) {
		fieldErrors.lastName = "Last name must be 80 characters or fewer.";
	}

	if (!email) {
		fieldErrors.email = "Enter your email address.";
	} else if (!EMAIL_PATTERN.test(emailNormalized)) {
		fieldErrors.email = "Enter a valid email address.";
	}

	if (password.length < 8) {
		fieldErrors.password = "Password must be at least 8 characters.";
	} else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
		fieldErrors.password = "Password must include a letter and a number.";
	}

	if (Object.keys(fieldErrors).length > 0) {
		return { success: false, fieldErrors };
	}

	return {
		success: true,
		data: {
			firstName,
			lastName,
			email,
			emailNormalized,
			password
		}
	};
}

export function registrationInputFromFormData(
	formData: FormData
): RegistrationInput {
	return {
		firstName: String(formData.get("firstName") ?? ""),
		lastName: String(formData.get("lastName") ?? ""),
		email: String(formData.get("email") ?? ""),
		password: String(formData.get("password") ?? "")
	};
}
