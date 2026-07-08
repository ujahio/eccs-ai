import { NextResponse } from "next/server";
import { getTeacherCaseDraftRepository } from "@/features/teacher/case-authoring/drafts";
import {
	caseDraftFromUnknown,
	validateDraftForSave,
} from "@/features/teacher/case-authoring/schema";
import { requireTeacherSession } from "@/lib/auth/session";

export async function DELETE(request: Request) {
	const { profile } = await requireTeacherSession();
	const caseId = caseIdFromRequest(request);

	if (!caseId) {
		return NextResponse.json(
			{ error: "caseId is required to delete a draft." },
			{ status: 400 },
		);
	}

	const result = await getTeacherCaseDraftRepository().deleteDraft({
		caseId,
		teacherProfileId: profile.profileId,
	});

	if (!result) {
		return NextResponse.json({ error: "Draft not found." }, { status: 404 });
	}

	return NextResponse.json(result);
}

export async function GET(request: Request) {
	const { profile } = await requireTeacherSession();
	const caseId = caseIdFromRequest(request);
	const repository = getTeacherCaseDraftRepository();

	if (caseId) {
		const draft = await repository.getDraft(profile.profileId, caseId);

		if (!draft) {
			return NextResponse.json({ error: "Draft not found." }, { status: 404 });
		}

		return NextResponse.json({ draft });
	}

	const drafts = await repository.listDrafts(profile.profileId);
	const draft = await repository.getDraft(profile.profileId);

	return NextResponse.json({ draft, drafts });
}

export async function PUT(request: Request) {
	const { profile } = await requireTeacherSession();
	const body = await request.json().catch(() => null);
	const caseId = caseIdFromBody(body);
	const draft = caseDraftFromUnknown(
		typeof body === "object" && body !== null
			? (body as Record<string, unknown>).draft
			: null,
	);
	const validation = validateDraftForSave(draft);

	if (Object.keys(validation).length > 0) {
		return NextResponse.json({ validation }, { status: 400 });
	}

	const savedDraft = await getTeacherCaseDraftRepository().saveDraft({
		...(caseId ? { caseId } : {}),
		draft,
		now: Date.now(),
		teacherProfileId: profile.profileId,
	});

	if (!savedDraft) {
		return NextResponse.json({ error: "Draft not found." }, { status: 404 });
	}

	return NextResponse.json({ draft: savedDraft });
}

function caseIdFromRequest(request: Request) {
	return normalizedString(new URL(request.url).searchParams.get("caseId"));
}

function caseIdFromBody(body: unknown) {
	if (!isRecord(body)) {
		return null;
	}

	return (
		normalizedString(body.caseId) ??
		(isRecord(body.draft) ? normalizedString(body.draft.caseId) : null)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizedString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}
