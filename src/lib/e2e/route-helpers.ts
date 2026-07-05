import { NextResponse } from "next/server";
import { isE2EMode } from "@/lib/e2e/in-memory-auth";

type E2EEmailResult =
	| {
			email: string;
	  }
	| {
			response: NextResponse;
	  };

export function rejectNonE2EMode() {
	if (isE2EMode()) {
		return null;
	}

	return NextResponse.json(
		{ error: "This endpoint is only available in e2e mode." },
		{ status: 403 }
	);
}

export function getRequiredE2EEmailParam(request: Request): E2EEmailResult {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return { response: modeResponse };
	}

	const url = new URL(request.url);
	const email = url.searchParams.get("email")?.toLowerCase().trim() ?? "";

	if (!email) {
		return {
			response: NextResponse.json(
				{ error: "Missing required query parameter: email" },
				{ status: 400 }
			)
		};
	}

	return { email };
}
