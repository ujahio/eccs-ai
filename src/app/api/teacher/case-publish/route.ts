import { NextResponse } from "next/server";
import {
	ActivePublishedCaseError,
	getTeacherCasePublisher,
	PublishDraftNotFoundError,
	PublishValidationError,
} from "@/features/teacher/case-authoring/publishing";
import { getCaseLifecycleNotificationService } from "@/features/case-notifications/server";
import { caseDraftFromUnknown } from "@/features/teacher/case-authoring/schema";
import { requireTeacherSession } from "@/lib/auth/session";

export async function POST(request: Request) {
	const { profile } = await requireTeacherSession();
	const body = await request.json().catch(() => null);
	const caseId = caseIdFromBody(body);
	const draft = caseDraftFromUnknown(
		typeof body === "object" && body !== null
			? (body as Record<string, unknown>).draft
			: null,
	);

	try {
		const publishedCase = await getTeacherCasePublisher().publishDraft({
			...(caseId ? { caseId } : {}),
			draft,
			now: Date.now(),
			teacherProfileId: profile.profileId,
		});
		await getCaseLifecycleNotificationService().sendNewCasePublishedEmail(
			publishedCase,
		);

		return NextResponse.json({
			case: {
				caseId: publishedCase.caseId,
				deadlineAt: publishedCase.deadlineAt,
				publishedAt: publishedCase.publishedAt,
				title: publishedCase.title,
			},
		});
	} catch (error) {
		if (error instanceof PublishValidationError) {
			return NextResponse.json(
				{ validation: error.validation },
				{ status: 400 },
			);
		}

		if (error instanceof ActivePublishedCaseError) {
			return NextResponse.json(
				{ error: "Publishing is unavailable while another case is active." },
				{ status: 409 },
			);
		}

		if (error instanceof PublishDraftNotFoundError) {
			return NextResponse.json({ error: "Draft not found." }, { status: 404 });
		}

		throw error;
	}
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
