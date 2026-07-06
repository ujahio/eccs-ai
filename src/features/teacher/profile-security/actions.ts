"use server";

import {
	submitProfileSecurityPasswordChangeForm,
	submitProfileSecurityPersonalDetailsForm,
} from "@/features/profile-security/actions";
import type {
	ProfileSecurityPasswordChangeFormState,
	ProfileSecurityPersonalDetailsFormState,
} from "@/features/profile-security/state";
import { requireTeacherSession, sessionToken } from "@/lib/auth/session";

export async function submitTeacherPersonalDetailsForm(
	_state: ProfileSecurityPersonalDetailsFormState,
	formData: FormData,
): Promise<ProfileSecurityPersonalDetailsFormState> {
	const { profile } = await requireTeacherSession();

	return submitProfileSecurityPersonalDetailsForm({
		profile,
		formData,
		pathToRevalidate: "/teacher/profile",
	});
}

export async function submitTeacherPasswordChangeForm(
	_state: ProfileSecurityPasswordChangeFormState,
	formData: FormData,
): Promise<ProfileSecurityPasswordChangeFormState> {
	const { session, profile } = await requireTeacherSession();

	return submitProfileSecurityPasswordChangeForm({
		profile,
		formData,
		currentSessionToken: sessionToken(session.session),
	});
}
