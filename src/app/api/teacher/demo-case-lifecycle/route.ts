import { NextResponse } from "next/server";
import {
	DemoCaseLifecycleConflictError,
	DemoCaseLifecycleControlsDisabledError,
	getTeacherCaseDemoLifecycleService,
	DemoTeacherCaseNotFoundError,
	type DemoTeacherCaseLifecycle,
} from "@/features/teacher/cases/demo-case-lifecycle";
import { areDemoCaseLifecycleControlsEnabled } from "@/lib/env/demo-case-lifecycle-controls";
import { requireTeacherSession } from "@/lib/auth/session";

type DemoCaseLifecyclePayload = {
	caseId: string;
	lifecycle: DemoTeacherCaseLifecycle;
};

export async function PATCH(request: Request) {
	if (!areDemoCaseLifecycleControlsEnabled()) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const { profile } = await requireTeacherSession();
	const body = await request.json().catch(() => null);
	const payload = demoCaseLifecyclePayloadFromBody(body);

	if (!payload) {
		return NextResponse.json(
			{
				error:
					"Provide a caseId and lifecycle of either published or archived.",
			},
			{ status: 400 },
		);
	}

	try {
		const result = await getTeacherCaseDemoLifecycleService().setLifecycle({
			caseId: payload.caseId,
			lifecycle: payload.lifecycle,
			now: Date.now(),
			teacherProfileId: profile.profileId,
		});

		return NextResponse.json({
			archivedCaseIds: result.archivedCaseIds,
			case: result.case,
			changed: result.changed,
		});
	} catch (error) {
		if (
			error instanceof DemoCaseLifecycleControlsDisabledError ||
			error instanceof DemoTeacherCaseNotFoundError
		) {
			return NextResponse.json({ error: "Case not found." }, { status: 404 });
		}

		if (error instanceof DemoCaseLifecycleConflictError) {
			return NextResponse.json(
				{ error: "Case lifecycle changed. Refresh and try again." },
				{ status: 409 },
			);
		}

		throw error;
	}
}

function demoCaseLifecyclePayloadFromBody(
	body: unknown,
): DemoCaseLifecyclePayload | null {
	if (!isRecord(body)) {
		return null;
	}

	const caseId = normalizedString(body.caseId);
	const lifecycle = body.lifecycle;

	if (
		!caseId ||
		(lifecycle !== "published" && lifecycle !== "archived")
	) {
		return null;
	}

	return {
		caseId,
		lifecycle,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizedString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}
