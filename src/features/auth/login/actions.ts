"use server";

import { createLoginService } from "./server";
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
			message: result.message,
			values: {
				email: input.email,
				password: ""
			},
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

function toFormErrors(
	fieldErrors: Record<string, string | undefined>
): LoginFormState["errors"] {
	return Object.fromEntries(
		Object.entries(fieldErrors)
			.filter((entry): entry is [string, string] => Boolean(entry[1]))
			.map(([field, error]) => [field, [error]])
	) as LoginFormState["errors"];
}
