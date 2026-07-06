"use server";

import {
	submitProfileSecurityPasswordChangeForm,
	submitProfileSecurityPersonalDetailsForm,
} from "@/features/profile-security/actions";
import type {
	ProfileSecurityPersonalDetailsFormState,
	ProfileSecurityPasswordChangeFormState,
} from "@/features/profile-security/state";
import {
	requireStudentSession,
	sessionToken,
} from "@/lib/auth/session";

export async function submitStudentPersonalDetailsForm(
	_state: ProfileSecurityPersonalDetailsFormState,
	formData: FormData,
): Promise<ProfileSecurityPersonalDetailsFormState> {
	const { profile } = await requireStudentSession();

	return submitProfileSecurityPersonalDetailsForm({
		profile,
		formData,
		pathToRevalidate: "/student/profile",
	});
}

export async function submitStudentPasswordChangeForm(
	_state: ProfileSecurityPasswordChangeFormState,
	formData: FormData,
): Promise<ProfileSecurityPasswordChangeFormState> {
	const { session, profile } = await requireStudentSession();

	return submitProfileSecurityPasswordChangeForm({
		profile,
		formData,
		currentSessionToken: sessionToken(session.session),
	});
}
