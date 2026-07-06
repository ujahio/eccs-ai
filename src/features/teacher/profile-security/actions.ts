"use server";

import { revalidatePath } from "next/cache";
import { toFormErrors } from "@/features/auth/form-errors";
import { normalizeEmail } from "@/features/auth/registration/schema";
import { createProfileSecurityService } from "@/features/student/profile-security/server";
import {
	parseStudentEmailChangeInput,
	parseStudentNameInput,
	studentEmailChangeInputFromFormData,
	studentNameInputFromFormData,
	studentPasswordChangeInputFromFormData,
} from "@/features/student/profile-security/schema";
import type {
	StudentPasswordChangeFormState,
	StudentPersonalDetailsFormState,
} from "@/features/student/profile-security/state";
import { requireTeacherSession, sessionToken } from "@/lib/auth/session";

export async function submitTeacherPersonalDetailsForm(
	_state: StudentPersonalDetailsFormState,
	formData: FormData,
): Promise<StudentPersonalDetailsFormState> {
	const { profile } = await requireTeacherSession();
	const service = createProfileSecurityService();
	const nameInput = studentNameInputFromFormData(formData);
	const emailInput = studentEmailChangeInputFromFormData(formData);
	const values = {
		firstName: nameInput.firstName,
		lastName: nameInput.lastName,
		email: emailInput.email,
	};
	const parsedName = parseStudentNameInput(nameInput);
	const parsedEmail = parseStudentEmailChangeInput(emailInput);
	const errors: StudentPersonalDetailsFormState["errors"] = {};

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
		normalizeEmail(emailInput.email) !== profile.emailNormalized;
	let emailMessage = "";

	if (isEmailChanged) {
		const emailResult = await service.requestEmailChange(profile, emailInput);

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

	const nameResult = await service.updateName(profile, nameInput);

	if (nameResult.status === "validation_error") {
		return {
			status: "error",
			message: nameResult.message,
			values,
			errors: toFormErrors(nameResult.fieldErrors),
		};
	}

	revalidatePath("/teacher/profile");

	return {
		status: "success",
		message: emailMessage || nameResult.message,
		values: {
			firstName: nameInput.firstName.trim(),
			lastName: nameInput.lastName.trim(),
			email: isEmailChanged
				? normalizeEmail(emailInput.email)
				: profile.emailNormalized,
		},
		errors: {},
	};
}

export async function submitTeacherPasswordChangeForm(
	_state: StudentPasswordChangeFormState,
	formData: FormData,
): Promise<StudentPasswordChangeFormState> {
	const { session, profile } = await requireTeacherSession();
	const service = createProfileSecurityService();
	const input = studentPasswordChangeInputFromFormData(formData);
	const result = await service.changePassword({
		profile,
		input,
		currentSessionToken: sessionToken(session.session),
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
