import "server-only";

import { revalidatePath } from "next/cache";
import { toFormErrors } from "@/features/auth/form-errors";
import { normalizeEmail } from "@/features/auth/registration/schema";
import type { AppProfileRecord } from "@/features/auth/registration/repository";
import {
	parseProfileSecurityEmailChangeInput,
	parseProfileSecurityNameInput,
	profileSecurityEmailChangeInputFromFormData,
	profileSecurityNameInputFromFormData,
	profileSecurityPasswordChangeInputFromFormData,
} from "@/features/profile-security/schema";
import { createProfileSecurityService } from "@/features/profile-security/server";
import type {
	ProfileSecurityPasswordChangeFormState,
	ProfileSecurityPersonalDetailsFormState,
} from "@/features/profile-security/state";

export async function submitProfileSecurityPersonalDetailsForm(args: {
	profile: AppProfileRecord;
	formData: FormData;
	pathToRevalidate: string;
}): Promise<ProfileSecurityPersonalDetailsFormState> {
	const service = createProfileSecurityService();
	const nameInput = profileSecurityNameInputFromFormData(args.formData);
	const emailInput = profileSecurityEmailChangeInputFromFormData(args.formData);
	const values = {
		firstName: nameInput.firstName,
		lastName: nameInput.lastName,
		email: emailInput.email,
	};
	const parsedName = parseProfileSecurityNameInput(nameInput);
	const parsedEmail = parseProfileSecurityEmailChangeInput(emailInput);
	const errors: ProfileSecurityPersonalDetailsFormState["errors"] = {};

	if (!parsedName.success) {
		Object.assign(errors, toFormErrors(parsedName.fieldErrors));
	}

	if (!parsedEmail.success) {
		Object.assign(errors, toFormErrors(parsedEmail.fieldErrors));
	}

	if (Object.keys(errors).length > 0) {
		return {
			status: "error",
			message: "Check the highlighted fields and try again.",
			values,
			errors,
		};
	}

	const isEmailChanged =
		normalizeEmail(emailInput.email) !== args.profile.emailNormalized;
	let emailMessage = "";

	if (isEmailChanged) {
		const emailResult = await service.requestEmailChange(
			args.profile,
			emailInput,
		);

		if (
			emailResult.status === "validation_error" ||
			emailResult.status === "same_email" ||
			emailResult.status === "email_unavailable"
		) {
			return {
				status: "error",
				message: emailResult.message,
				values,
				errors:
					emailResult.status === "validation_error"
						? toFormErrors(emailResult.fieldErrors)
						: {},
			};
		}

		emailMessage = emailResult.message;
	}

	const nameResult = await service.updateName(args.profile, nameInput);

	if (nameResult.status === "validation_error") {
		return {
			status: "error",
			message: nameResult.message,
			values,
			errors: toFormErrors(nameResult.fieldErrors),
		};
	}

	revalidatePath(args.pathToRevalidate);

	return {
		status: "success",
		message: emailMessage || nameResult.message,
		values: {
			firstName: nameInput.firstName.trim(),
			lastName: nameInput.lastName.trim(),
			email: isEmailChanged
				? normalizeEmail(emailInput.email)
				: args.profile.emailNormalized,
		},
		errors: {},
	};
}

export async function submitProfileSecurityPasswordChangeForm(args: {
	profile: AppProfileRecord;
	formData: FormData;
	currentSessionToken: string | null;
}): Promise<ProfileSecurityPasswordChangeFormState> {
	const service = createProfileSecurityService();
	const input = profileSecurityPasswordChangeInputFromFormData(args.formData);
	const result = await service.changePassword({
		profile: args.profile,
		input,
		currentSessionToken: args.currentSessionToken,
	});
	const emptyValues = {
		currentPassword: "",
		password: "",
		confirmPassword: "",
	};

	if (result.status === "validation_error") {
		return {
			status: "error",
			message: result.message,
			values: emptyValues,
			errors: toFormErrors(result.fieldErrors),
		};
	}

	if (result.status === "invalid_current_password") {
		return {
			status: "error",
			message: result.message,
			values: emptyValues,
			errors: {
				currentPassword: [result.message],
			},
		};
	}

	return {
		status: "success",
		message: result.message,
		values: emptyValues,
		errors: {},
	};
}
