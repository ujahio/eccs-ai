import { NextResponse } from "next/server";
import { isE2EMode, resetE2EAuthStore } from "@/lib/e2e/in-memory-auth";

export async function GET() {
	if (!isE2EMode()) {
		return NextResponse.json(
			{ error: "This endpoint is only available in e2e mode." },
			{ status: 403 }
		);
	}

	return NextResponse.json({ mode: "memory" });
}

export async function DELETE() {
	if (!isE2EMode()) {
		return NextResponse.json(
			{ error: "This endpoint is only available in e2e mode." },
			{ status: 403 }
		);
	}

	resetE2EAuthStore();

	return NextResponse.json({ reset: true });
}
