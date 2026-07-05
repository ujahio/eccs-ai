"use server";

import { toFormErrors } from "@/features/auth/form-errors";
import { redirect } from "next/navigation";
import {
	passwordResetConfirmInputFromFormData,
	passwordResetRequestInputFromFormData,
} from "./schema";
import { createPasswordResetService } from "./server";
import type {
	PasswordResetConfirmFormState,
	PasswordResetRequestFormState,
} from "./state";

export async function submitPasswordResetRequestForm(
	_state: PasswordResetRequestFormState,
	formData: FormData,
): Promise<PasswordResetRequestFormState> {
	const service = createPasswordResetService();
	const input = passwordResetRequestInputFromFormData(formData);
	const result = await service.requestPasswordReset(input);
	const values = { email: input.email };

	if (result.status === "validation_error") {
		return {
			status: "error",
			message: result.message,
			values,
			errors: toFormErrors(result.fieldErrors),
		};
	}

	if (result.status === "rate_limited") {
		return {
			status: "notice",
			message: result.message,
			values,
			errors: {},
		};
	}

	if (result.status === "delivery_unavailable") {
		return {
			status: "success",
			message: result.message,
			values,
			errors: {},
		};
	}

	return {
		status: "success",
		message: result.message,
		values,
		errors: {},
	};
}

export async function submitPasswordResetConfirmForm(
	_state: PasswordResetConfirmFormState,
	formData: FormData,
): Promise<PasswordResetConfirmFormState> {
	const service = createPasswordResetService();
	const input = passwordResetConfirmInputFromFormData(formData);
	const result = await service.confirmPasswordReset(input);
	const values = {
		email: input.email,
		code: input.code,
		password: "",
		confirmPassword: "",
	};

	if (result.status === "validation_error") {
		return {
			status: "error",
			message: result.message,
			values,
			errors: toFormErrors(result.fieldErrors),
		};
	}

	if (result.status === "invalid_code") {
		redirect("/forgot-password?reset=invalid");
	}

	if (result.status === "rate_limited") {
		return {
			status: "notice",
			message: result.message,
			values,
			errors: {},
		};
	}

	redirect("/login?reset=changed");
}
