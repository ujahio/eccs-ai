import { NextResponse } from "next/server";
import { getRequiredE2EEmailParam } from "@/lib/e2e/route-helpers";
import { getE2EAdapters } from "@/lib/e2e/in-memory-auth";

export async function GET(request: Request) {
	const emailResult = getRequiredE2EEmailParam(request);

	if ("response" in emailResult) {
		return emailResult.response;
	}

	const { email: emailSender } = getE2EAdapters();
	const verificationUrl = emailSender.getLastEmailChangeVerificationUrl(
		emailResult.email,
	);

	if (!verificationUrl) {
		return NextResponse.json(
			{ error: "No email change verification email found for this address." },
			{ status: 404 },
		);
	}

	return NextResponse.json({ verificationUrl });
}
