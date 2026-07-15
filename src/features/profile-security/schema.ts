import { z } from "zod";
import {
	failedPasswordRequirements,
	normalizeEmail,
	passwordRequirementMessage,
	zodFieldErrors,
	type PasswordRequirement,
} from "@/features/auth/registration/schema";

export type ProfileSecurityNameInput = {
	firstName: string;
	lastName: string;
};

export type ProfileSecurityEmailChangeInput = {
	email: string;
};

export type ProfileSecurityPasswordChangeInput = {
	currentPassword: string;
	password: string;
	confirmPassword: string;
};

export type ProfileSecurityNameFieldErrors = Partial<Record<keyof ProfileSecurityNameInput, string>>;
export type ProfileSecurityEmailChangeFieldErrors = Partial<
	Record<keyof ProfileSecurityEmailChangeInput, string>
>;
export type ProfileSecurityPasswordChangeFieldErrors = Partial<
	Record<keyof ProfileSecurityPasswordChangeInput, string>
>;

export type ParsedProfileSecurityNameInput =
	| { success: true; data: ProfileSecurityNameInput & { fullName: string } }
	| { success: false; fieldErrors: ProfileSecurityNameFieldErrors };

export type ParsedProfileSecurityEmailChangeInput =
	| {
			success: true;
			data: ProfileSecurityEmailChangeInput & { emailNormalized: string };
	  }
	| { success: false; fieldErrors: ProfileSecurityEmailChangeFieldErrors };

export type ParsedProfileSecurityPasswordChangeInput =
	| { success: true; data: ProfileSecurityPasswordChangeInput }
	| {
			success: false;
			fieldErrors: ProfileSecurityPasswordChangeFieldErrors;
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

export function parseProfileSecurityNameInput(
	input: ProfileSecurityNameInput,
): ParsedProfileSecurityNameInput {
	const parsed = nameSchema.safeParse(input);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodFieldErrors(parsed.error),
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

export function parseProfileSecurityEmailChangeInput(
	input: ProfileSecurityEmailChangeInput,
): ParsedProfileSecurityEmailChangeInput {
	const parsed = emailChangeSchema.safeParse(input);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodFieldErrors(parsed.error),
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

export function parseProfileSecurityPasswordChangeInput(
	input: ProfileSecurityPasswordChangeInput,
): ParsedProfileSecurityPasswordChangeInput {
	const parsed = passwordChangeSchema.safeParse(input);
	const failedRequirementIds = failedPasswordRequirements(input.password).map(
		(requirement) => requirement.id,
	);

	if (!parsed.success) {
		return {
			success: false,
			fieldErrors: zodFieldErrors(parsed.error),
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

export function profileSecurityNameInputFromFormData(
	formData: FormData,
): ProfileSecurityNameInput {
	return {
		firstName: String(formData.get("firstName") ?? ""),
		lastName: String(formData.get("lastName") ?? ""),
	};
}

export function profileSecurityEmailChangeInputFromFormData(
	formData: FormData,
): ProfileSecurityEmailChangeInput {
	return {
		email: String(formData.get("email") ?? ""),
	};
}

export function profileSecurityPasswordChangeInputFromFormData(
	formData: FormData,
): ProfileSecurityPasswordChangeInput {
	return {
		currentPassword: String(formData.get("currentPassword") ?? ""),
		password: String(formData.get("password") ?? ""),
		confirmPassword: String(formData.get("confirmPassword") ?? ""),
	};
}
