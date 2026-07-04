import { NextResponse } from "next/server";
import {
	getE2EAuthStore,
	isE2EMode,
	resetE2EAuthStore
} from "@/lib/e2e/in-memory-auth";
import { isKnownCognitoGroup } from "@/lib/auth/cognito-groups";

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

export async function PATCH(request: Request) {
	if (!isE2EMode()) {
		return NextResponse.json(
			{ error: "This endpoint is only available in e2e mode." },
			{ status: 403 }
		);
	}

	const body = await request.json().catch(() => null);
	const email =
		typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
	const user = email ? getE2EAuthStore().users.get(email) : undefined;

	if (!email) {
		return NextResponse.json(
			{ error: "Missing required field: email" },
			{ status: 400 }
		);
	}

	if (!user) {
		return NextResponse.json(
			{ error: "No e2e user found for this address." },
			{ status: 404 }
		);
	}

	if (typeof body.enabled === "boolean") {
		user.enabled = body.enabled;
	}

	if (Array.isArray(body.groups)) {
		user.groups = body.groups.filter(isKnownCognitoGroup);
	}

	return NextResponse.json({
		user: {
			email,
			enabled: user.enabled,
			groups: user.groups
		}
	});
}
