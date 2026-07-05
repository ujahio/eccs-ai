import { z } from "zod";
import {
	failedPasswordRequirements,
	normalizeEmail,
	type PasswordRequirement,
} from "@/features/auth/registration/schema";

export type StudentNameInput = {
	firstName: string;
	lastName: string;
};

export type StudentEmailChangeInput = {
	email: string;
};

export type StudentPasswordChangeInput = {
	currentPassword: string;
	password: string;
	confirmPassword: string;
};

export type StudentNameFieldErrors = Partial<Record<keyof StudentNameInput, string>>;
export type StudentEmailChangeFieldErrors = Partial<
	Record<keyof StudentEmailChangeInput, string>
>;
export type StudentPasswordChangeFieldErrors = Partial<
	Record<keyof StudentPasswordChangeInput, string>
>;

export type ParsedStudentNameInput =
	| { success: true; data: StudentNameInput & { fullName: string } }
	| { success: false; fieldErrors: StudentNameFieldErrors };

export type ParsedStudentEmailChangeInput =
	| {
			success: true;
			data: StudentEmailChangeInput & { emailNormalized: string };
	  }
	| { success: false; fieldErrors: StudentEmailChangeFieldErrors };

export type ParsedStudentPasswordChangeInput =
	| { success: true; data: StudentPasswordChangeInput }
	| {
			success: false;
			fieldErrors: StudentPasswordChangeFieldErrors;
			failedPasswordRequirementIds: PasswordRequirement["id"][];
	  };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const nameSchema = z.object({
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
});

const emailChangeSchema = z.object({
	email: z
		.string()
		.trim()
		.min(1, { message: "Enter your new email address." })
		.refine((email) => EMAIL_PATTERN.test(normalizeEmail(email)), {
			message: "Enter a valid email address.",
		}),
});

const passwordChangeSchema = z
	.object({
		currentPassword: z.string().min(1, {
			message: "Enter your current password.",
		}),
		password: z.string(),
		confirmPassword: z.string().min(1, {
			message: "Confirm your new password.",
		}),
	})
	.superRefine((input, ctx) => {
		const missingPasswordRequirements = failedPasswordRequirements(
			input.password,
		);

		if (missingPasswordRequirements.length > 0) {
			ctx.addIssue({
				code: "custom",
				path: ["password"],
				message: passwordRequirementMessage(missingPasswordRequirements),
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
				message: "Passwords do not match.",
			});
		}

		if (input.currentPassword && input.currentPassword === input.password) {
			ctx.addIssue({
				code: "custom",
				path: ["password"],
				message: "Choose a new password that is different from the current one.",
			});
		}
	});

export function parseStudentNameInput(
	input: StudentNameInput,
): ParsedStudentNameInput {
	const parsed = nameSchema.safeParse(input);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodErrorToFieldErrors(parsed.error, [
				"firstName",
				"lastName",
			]),
		};
	}

	return {
		success: true,
		data: {
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			fullName: `${parsed.data.firstName} ${parsed.data.lastName}`,
		},
	};
}

export function parseStudentEmailChangeInput(
	input: StudentEmailChangeInput,
): ParsedStudentEmailChangeInput {
	const parsed = emailChangeSchema.safeParse(input);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodErrorToFieldErrors(parsed.error, ["email"]),
		};
	}

	return {
		success: true,
		data: {
			email: parsed.data.email,
			emailNormalized: normalizeEmail(parsed.data.email),
		},
	};
}

export function parseStudentPasswordChangeInput(
	input: StudentPasswordChangeInput,
): ParsedStudentPasswordChangeInput {
	const parsed = passwordChangeSchema.safeParse(input);
	const failedRequirementIds = failedPasswordRequirements(input.password).map(
		(requirement) => requirement.id,
	);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodErrorToFieldErrors(parsed.error, [
				"currentPassword",
				"password",
				"confirmPassword",
			]),
			failedPasswordRequirementIds: failedRequirementIds,
		};
	}

	return {
		success: true,
		data: {
			currentPassword: parsed.data.currentPassword,
			password: parsed.data.password,
			confirmPassword: parsed.data.confirmPassword,
		},
	};
}

function zodErrorToFieldErrors<Field extends string>(
	error: z.ZodError,
	fields: Field[],
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

export function studentNameInputFromFormData(
	formData: FormData,
): StudentNameInput {
	return {
		firstName: String(formData.get("firstName") ?? ""),
		lastName: String(formData.get("lastName") ?? ""),
	};
}

export function studentEmailChangeInputFromFormData(
	formData: FormData,
): StudentEmailChangeInput {
	return {
		email: String(formData.get("email") ?? ""),
	};
}

export function studentPasswordChangeInputFromFormData(
	formData: FormData,
): StudentPasswordChangeInput {
	return {
		currentPassword: String(formData.get("currentPassword") ?? ""),
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? ""),
	};
}
