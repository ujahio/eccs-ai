import {
	createStudentCaseAttachmentUrl,
	getStudentCaseAttachment,
	isValidStudentCaseAttachmentUrl,
	studentCaseAttachmentUrlExpiresAt,
	type StudentCaseAttachmentDisposition,
} from "@/features/student/cases/student-case";
import { getCaseMaterialStorage } from "@/features/case-materials/storage";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { requireStudentSession } from "@/lib/auth/session";

type StudentCaseAttachmentRouteContext = {
	params: Promise<{
		attachmentId: string;
		caseId: string;
	}>;
};

export async function GET(
	request: Request,
	{ params }: StudentCaseAttachmentRouteContext,
) {
	await requireStudentSession();

	const { attachmentId, caseId } = await params;
	const url = new URL(request.url);
	const disposition = attachmentDispositionFromValue(
		url.searchParams.get("disposition"),
	);
	const expiresAt = Number(url.searchParams.get("expires"));
	const signature = url.searchParams.get("signature");

	if (!disposition) {
		return new Response("Attachment link expired.", { status: 403 });
	}

	if (!signature || !Number.isFinite(expiresAt)) {
		const attachment = await getStudentCaseAttachment({ attachmentId, caseId });

		if (!attachment) {
			return new Response("Attachment not found.", { status: 404 });
		}

		const signedUrl = createStudentCaseAttachmentUrl({
			attachmentId,
			caseId,
			disposition,
			expiresAt: studentCaseAttachmentUrlExpiresAt(Date.now()),
			secret: getSessionAuthResources().betterAuthSecret,
		});

		return Response.redirect(new URL(signedUrl, request.url), 307);
	}

	if (
		!isValidStudentCaseAttachmentUrl({
			attachmentId,
			caseId,
			disposition,
			expiresAt,
			now: Date.now(),
			signature,
		})
	) {
		return new Response("Attachment link expired.", { status: 403 });
	}

	const attachment = await getStudentCaseAttachment({ attachmentId, caseId });

	if (!attachment) {
		return new Response("Attachment not found.", { status: 404 });
	}

	const signedStorageUrl = await getCaseMaterialStorage().getSignedReadUrl({
		disposition,
		name: attachment.name,
		storageKey: attachment.storageKey,
	});

	return Response.redirect(new URL(signedStorageUrl, request.url), 307);
}

function attachmentDispositionFromValue(
	value: string | null,
): StudentCaseAttachmentDisposition | null {
	return value === "inline" || value === "attachment" ? value : null;
}
