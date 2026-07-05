import { redirect } from "next/navigation";
import { createStudentProfileService } from "@/features/student/profile-security/server";

const LOGIN_EMAIL_CHANGE_MESSAGES = {
	verified_sign_in_required: "verified",
	invalid: "invalid",
	expired: "expired",
	already_used: "used",
} as const;

export async function GET(request: Request) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	const service = createStudentProfileService();
	const result = await service.verifyEmailChange({
		token,
	});

	const loginUrl = new URL("/login", request.url);
	loginUrl.searchParams.set(
		"emailChange",
		LOGIN_EMAIL_CHANGE_MESSAGES[result.status],
	);

	redirect(loginUrl.pathname + loginUrl.search);
}
