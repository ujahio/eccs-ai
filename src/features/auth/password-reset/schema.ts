import { z } from "zod";
import {
	failedPasswordRequirements,
	normalizeEmail,
	type PasswordRequirement
} from "@/features/auth/registration/schema";

export type PasswordResetRequestInput = {
	email: string;
};

export type PasswordResetConfirmInput = {
	email: string;
	code: string;
	password: string;
	confirmPassword: string;
};

export type PasswordResetRequestFieldErrors = Partial<
	Record<keyof PasswordResetRequestInput, string>
>;

export type PasswordResetConfirmFieldErrors = Partial<
	Record<keyof PasswordResetConfirmInput, string>
>;

export type ParsedPasswordResetRequestInput =
	| {
			success: true;
			data: PasswordResetRequestInput & { emailNormalized: string };
	  }
	| {
			success: false;
			fieldErrors: PasswordResetRequestFieldErrors;
	  };

export type ParsedPasswordResetConfirmInput =
	| {
			success: true;
			data: PasswordResetConfirmInput & { emailNormalized: string };
	  }
	| {
			success: false;
			fieldErrors: PasswordResetConfirmFieldErrors;
			failedPasswordRequirementIds: PasswordRequirement["id"][];
	  };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RESET_CODE_PATTERN = /^\d{6}$/;

export function isPasswordResetCodeFormatValid(code: string) {
	return PASSWORD_RESET_CODE_PATTERN.test(code.trim());
}

const requestSchema = z.object({
	email: z
		.string()
		.trim()
		.min(1, { message: "Enter your email address." })
		.refine((email) => EMAIL_PATTERN.test(normalizeEmail(email)), {
			message: "Enter a valid email address."
		})
});

const confirmSchema = z
	.object({
		email: z
			.string()
			.trim()
			.min(1, { message: "Enter your email address." })
			.refine((email) => EMAIL_PATTERN.test(normalizeEmail(email)), {
				message: "Enter a valid email address."
			}),
		code: z.string().trim().min(1, {
			message: "Use the password reset link from your email."
		}),
		password: z.string(),
		confirmPassword: z.string().min(1, {
			message: "Confirm your new password."
		})
	})
	.superRefine((input, ctx) => {
		const missingPasswordRequirements = failedPasswordRequirements(
			input.password
		);

		if (missingPasswordRequirements.length > 0) {
			ctx.addIssue({
				code: "custom",
				path: ["password"],
				message: passwordRequirementMessage(missingPasswordRequirements)
			});
		}

		if (
			input.confirmPassword &&
			input.password &&
			input.password !== input.confirmPassword
		) {
			ctx.addIssue({
				code: "custom",
				path: ["confirmPassword"],
				message: "Passwords do not match."
			});
		}
	});

export function parsePasswordResetRequestInput(
	input: PasswordResetRequestInput
): ParsedPasswordResetRequestInput {
	const parsed = requestSchema.safeParse(input);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodErrorToFieldErrors(parsed.error, ["email"])
		};
	}

	return {
		success: true,
		data: {
			email: parsed.data.email,
			emailNormalized: normalizeEmail(parsed.data.email)
		}
	};
}

export function parsePasswordResetConfirmInput(
	input: PasswordResetConfirmInput
): ParsedPasswordResetConfirmInput {
	const parsed = confirmSchema.safeParse(input);
	const failedRequirementIds = failedPasswordRequirements(input.password).map(
		(requirement) => requirement.id
	);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodErrorToFieldErrors(parsed.error, [
				"email",
				"code",
				"password",
				"confirmPassword"
			]),
			failedPasswordRequirementIds: failedRequirementIds
		};
	}

	return {
		success: true,
		data: {
			email: parsed.data.email,
			emailNormalized: normalizeEmail(parsed.data.email),
			code: parsed.data.code,
			password: parsed.data.password,
			confirmPassword: parsed.data.confirmPassword
		}
	};
}

function zodErrorToFieldErrors<Field extends string>(
	error: z.ZodError,
	fields: Field[]
): Partial<Record<Field, string>> {
	const fieldSet = new Set(fields);
	const fieldErrors: Partial<Record<Field, string>> = {};

	for (const issue of error.issues) {
		const field = issue.path[0];

		if (typeof field === "string" && fieldSet.has(field as Field)) {
			fieldErrors[field as Field] ??= issue.message;
		}
	}

	return fieldErrors;
}

function passwordRequirementMessage(requirements: PasswordRequirement[]) {
	return `Password is missing: ${requirements
		.map((requirement) => requirement.label.toLowerCase())
		.join(", ")}.`;
}

export function passwordResetRequestInputFromFormData(
	formData: FormData
): PasswordResetRequestInput {
	return {
		email: String(formData.get("email") ?? "")
	};
}

export function passwordResetConfirmInputFromFormData(
	formData: FormData
): PasswordResetConfirmInput {
	return {
		email: String(formData.get("email") ?? ""),
		code: String(formData.get("code") ?? ""),
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? "")
	};
}
