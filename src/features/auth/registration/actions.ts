"use server";

import { redirect } from "next/navigation";
import { createRegistrationService } from "./server";
import { toFormErrors } from "../form-errors";
import {
	failedPasswordRequirements,
	registrationInputFromFormData
} from "./schema";
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
			errors: toFormErrors(result.fieldErrors),
			failedPasswordRequirementIds: failedPasswordRequirements(
				input.password
			).map((requirement) => requirement.id)
		};
	}

	if (result.status === "resend_blocked") {
		return {
			status: "notice",
			message: result.message,
			values,
			errors: {},
			failedPasswordRequirementIds: []
		};
	}

	if (result.status === "account_exists") {
		return {
			status: "error",
			message: result.message,
			values,
			errors: {},
			failedPasswordRequirementIds: []
		};
	}

	redirect("/login?registration=verification_sent");
}
