import { NextResponse } from "next/server";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";

export async function GET(request: Request) {
	if (!isE2EMode()) {
		return NextResponse.json(
			{ error: "This endpoint is only available in e2e mode." },
			{ status: 403 }
		);
	}

	const url = new URL(request.url);
	const email = url.searchParams.get("email");

	if (!email) {
		return NextResponse.json(
			{ error: "Missing required query parameter: email" },
			{ status: 400 }
		);
	}

	const { email: emailSender } = getE2EAdapters();
	const sent = emailSender.hasPasswordChangedEmail(
		email.toLowerCase().trim()
	);

	return NextResponse.json({ sent });
}
