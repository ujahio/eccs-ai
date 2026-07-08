import { NextResponse } from "next/server";
import { getTeacherCaseDraftRepository } from "@/features/teacher/case-authoring/drafts";
import { caseDraftFromUnknown } from "@/features/teacher/case-authoring/schema";
import { requireTeacherSession } from "@/lib/auth/session";

export async function GET() {
	const { profile } = await requireTeacherSession();
	const draft = await getTeacherCaseDraftRepository().getDraft(profile.profileId);

	return NextResponse.json({ draft });
}

export async function PUT(request: Request) {
	const { profile } = await requireTeacherSession();
	const body = await request.json().catch(() => null);
	const draft = caseDraftFromUnknown(
		typeof body === "object" && body !== null
			? (body as Record<string, unknown>).draft
			: null,
	);
	const savedDraft = await getTeacherCaseDraftRepository().saveDraft({
		draft,
		now: Date.now(),
		teacherProfileId: profile.profileId,
	});

	return NextResponse.json({ draft: savedDraft });
}
