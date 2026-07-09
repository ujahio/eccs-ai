import { NextResponse } from "next/server";
import {
	bootstrapE2EStudent,
	bootstrapE2ETeacher,
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

export async function POST(request: Request) {
	if (!isE2EMode()) {
		return NextResponse.json(
			{ error: "This endpoint is only available in e2e mode." },
			{ status: 403 }
		);
	}

	const body = await request.json().catch(() => null);

	if (body?.action === "bootstrap_student") {
		const result = bootstrapE2EStudent({
			email: String(body.email ?? ""),
			firstName: String(body.firstName ?? ""),
			lastName: String(body.lastName ?? ""),
			password: String(body.password ?? ""),
			emailVerified:
				typeof body.emailVerified === "boolean" ? body.emailVerified : true,
		});

		return NextResponse.json({ student: result });
	}

	if (body?.action !== "bootstrap_teacher") {
		return NextResponse.json(
			{ error: "Unsupported e2e auth state action." },
			{ status: 400 }
		);
	}

	const result = bootstrapE2ETeacher({
		email: String(body.email ?? ""),
		firstName: String(body.firstName ?? ""),
		lastName: String(body.lastName ?? ""),
		temporaryPassword: String(body.temporaryPassword ?? ""),
		emailVerified:
			typeof body.emailVerified === "boolean" ? body.emailVerified : true,
		forcePasswordChange:
			typeof body.forcePasswordChange === "boolean"
				? body.forcePasswordChange
				: true,
	});

	return NextResponse.json({ teacher: result });
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

	if (typeof body.emailVerified === "boolean") {
		user.emailVerified = body.emailVerified;
	}

	if (typeof body.forcePasswordChange === "boolean") {
		user.forcePasswordChange = body.forcePasswordChange;
	}

	if (Array.isArray(body.groups)) {
		user.groups = body.groups.filter(isKnownCognitoGroup);
	}

	return NextResponse.json({
		user: {
			email,
			enabled: user.enabled,
			emailVerified: user.emailVerified,
			groups: user.groups
		}
	});
}
