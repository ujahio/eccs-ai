import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createProfileSecurityService } from "@/features/profile-security/server";
import { getAuth } from "@/lib/auth/auth";
import { sessionToken } from "@/lib/auth/session";

const LOGIN_EMAIL_CHANGE_MESSAGES = {
	verified_sign_in_required: "verified",
	invalid: "invalid",
	expired: "expired",
	already_used: "used",
} as const;

export async function GET(request: Request) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	const session = await getAuth().api.getSession({
		headers: await headers(),
	});
	const service = createProfileSecurityService();
	const result = await service.verifyEmailChange({
		token,
		currentSession: session
			? {
					profileId: session.user.id,
					token: sessionToken(session.session),
				}
			: undefined,
	});

	if (result.status === "verified_current_session_kept") {
		const profileUrl = new URL(`/${result.profile.role}/profile`, request.url);
		profileUrl.searchParams.set("email", "verified");

		redirect(profileUrl.pathname + profileUrl.search);
	}

	const loginUrl = new URL("/login", request.url);
	loginUrl.searchParams.set(
		"emailChange",
		LOGIN_EMAIL_CHANGE_MESSAGES[result.status],
	);

	redirect(loginUrl.pathname + loginUrl.search);
}
