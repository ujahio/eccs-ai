import { z } from "zod";

export type RegistrationInput = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
};

export type RegistrationFieldErrors = Partial<
	Record<keyof RegistrationInput, string>
>;

export type PasswordRequirement = {
	id: "minimumLength" | "lowercase" | "uppercase" | "number" | "symbol";
	label: string;
	isMet: (password: string) => boolean;
};

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
const COGNITO_PASSWORD_SYMBOLS = "^$*.[]{}()?\"!@#%&/\\,><':;|_~`=+-";

function hasCognitoPasswordSymbol(password: string) {
	return Array.from(password).some((character) =>
		COGNITO_PASSWORD_SYMBOLS.includes(character)
	);
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
	{
		id: "minimumLength",
		label: "At least 8 characters",
		isMet: (password) => password.length >= 8
	},
	{
		id: "lowercase",
		label: "At least one lowercase letter",
		isMet: (password) => /[a-z]/.test(password)
	},
	{
		id: "uppercase",
		label: "At least one uppercase letter",
		isMet: (password) => /[A-Z]/.test(password)
	},
	{
		id: "number",
		label: "At least one number",
		isMet: (password) => /\d/.test(password)
	},
	{
		id: "symbol",
		label: "At least one symbol",
		isMet: hasCognitoPasswordSymbol
	}
];

const registrationSchema = z.object({
	firstName: z
		.string()
		.trim()
		.min(1, { message: "Enter your first name." })
		.max(80, { message: "First name must be 80 characters or fewer." }),
	lastName: z
		.string()
		.trim()
		.min(1, { message: "Enter your last name." })
		.max(80, { message: "Last name must be 80 characters or fewer." }),
	email: z
		.string()
		.trim()
		.min(1, { message: "Enter your email address." })
		.refine((email) => EMAIL_PATTERN.test(normalizeEmail(email)), {
			message: "Enter a valid email address."
		}),
	password: z
		.string()
		.refine(
			(password) => failedPasswordRequirements(password).length === 0,
			{
				message: "Password does not meet requirements."
			}
		)
});

export function normalizeEmail(email: string) {
	return email.trim().toLowerCase();
}

export function failedPasswordRequirements(password: string) {
	return PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.isMet(password));
}

export function zodFieldErrors<T extends object>(
	error: z.ZodError<T>
): Partial<Record<keyof T, string>> {
	const fieldErrors: Partial<Record<keyof T, string>> = {};
	const entries = Object.entries(z.flattenError(error).fieldErrors) as Array<
		[keyof T, string[] | undefined]
	>;

	for (const [field, messages] of entries) {
		const message = messages?.[0];
		if (message) {
			fieldErrors[field] = message;
		}
	}

	return fieldErrors;
}

export function passwordRequirementMessage(requirements: PasswordRequirement[]) {
	return `Password is missing: ${requirements
		.map((requirement) => requirement.label.toLowerCase())
		.join(", ")}.`;
}

export function parseRegistrationInput(
	input: RegistrationInput
): ParsedRegistrationInput {
	const parsed = registrationSchema.safeParse(input);
	const missingPasswordRequirements = failedPasswordRequirements(input.password);

	if (!parsed.success) {
		const fieldErrors = zodFieldErrors(parsed.error);
		if (missingPasswordRequirements.length > 0) {
			fieldErrors.password = passwordRequirementMessage(
				missingPasswordRequirements
			);
		}
		return { success: false, fieldErrors };
	}

	return {
		success: true,
		data: {
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			email: parsed.data.email,
			emailNormalized: normalizeEmail(parsed.data.email),
			password: parsed.data.password
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
