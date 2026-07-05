import { NextResponse } from "next/server";
import { getE2EAdapters } from "@/lib/e2e/in-memory-auth";
import { getRequiredE2EEmailParam } from "@/lib/e2e/route-helpers";

export async function GET(request: Request) {
	const emailResult = getRequiredE2EEmailParam(request);

	if ("response" in emailResult) {
		return emailResult.response;
	}

	const { email: emailSender } = getE2EAdapters();
	const sent = emailSender.hasPasswordChangedEmail(emailResult.email);

	return NextResponse.json({ sent });
}
