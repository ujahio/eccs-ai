import { redirect } from "next/navigation";
import { createRegistrationService } from "@/features/auth/registration/server";

const LOGIN_VERIFICATION_MESSAGES = {
	verified: "verified",
	invalid: "invalid",
	expired: "expired",
	already_used: "used"
} as const;

export async function GET(request: Request) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	const service = createRegistrationService();
	const result = await service.verifyEmail(token);
	const loginUrl = new URL("/login", request.url);

	loginUrl.searchParams.set(
		"verification",
		LOGIN_VERIFICATION_MESSAGES[result.status]
	);

	redirect(loginUrl.pathname + loginUrl.search);
}
