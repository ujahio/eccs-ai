"use server";

import { createLoginService } from "./server";
import { toFormErrors } from "../form-errors";
import { loginInputFromFormData } from "./schema";
import type { LoginFormState } from "./state";

export async function submitLoginForm(
	_state: LoginFormState,
	formData: FormData
): Promise<LoginFormState> {
	const service = createLoginService();
	const input = loginInputFromFormData(formData);
	const result = await service.login(input);
	const values = {
		email: input.email,
		password: ""
	};

	if (result.status === "signed_in") {
		return {
			status: "success",
			message: "",
			values: {
				email: input.email,
				password: ""
			},
			errors: {}
		};
	}

	if (result.status === "new_password_required") {
		return {
			status: "blocked",
			message: "Set a new password to finish signing in.",
			values,
			errors: {}
		};
	}

	if (result.status === "validation_error") {
		return {
			status: "error",
			message: result.message,
			values,
			errors: toFormErrors(result.fieldErrors)
		};
	}

	if (result.status === "verify_email") {
		return {
			status: "blocked",
			message: result.message,
			values,
			errors: {}
		};
	}

	if (result.status === "invalid_credentials") {
		return {
			status: "error",
			message: result.message,
			values,
			errors: {}
		};
	}

	return {
		status: "error",
		message: result.message,
		values,
		errors: {}
	};
}
