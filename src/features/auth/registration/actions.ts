"use server";

import { createRegistrationService } from "./server";
import { registrationInputFromFormData } from "./schema";
import type { RegistrationFormState } from "./state";

export async function submitRegistrationForm(
	_state: RegistrationFormState,
	formData: FormData
): Promise<RegistrationFormState> {
	const service = createRegistrationService();
	const input = registrationInputFromFormData(formData);
	const result = await service.registerStudent(
		input
	);
	const values = {
		firstName: input.firstName,
		lastName: input.lastName,
		email: input.email,
		password: ""
	};

	if (result.status === "validation_error") {
		return {
			status: "error",
			message: result.message,
			values,
			errors: toFormErrors(result.fieldErrors)
		};
	}

	if (result.status === "resend_blocked") {
		return {
			status: "notice",
			message: result.message,
			values,
			errors: {}
		};
	}

	if (result.status === "account_exists") {
		return {
			status: "error",
			message: result.message,
			values,
			errors: {}
		};
	}

	return {
		status: "success",
		message: result.message,
		values: {
			firstName: "",
			lastName: "",
			email: input.email,
			password: ""
		},
		errors: {}
	};
}

function toFormErrors(
	fieldErrors: Record<string, string | undefined>
): RegistrationFormState["errors"] {
	return Object.fromEntries(
		Object.entries(fieldErrors)
			.filter((entry): entry is [string, string] => Boolean(entry[1]))
			.map(([field, error]) => [field, [error]])
	) as RegistrationFormState["errors"];
}
