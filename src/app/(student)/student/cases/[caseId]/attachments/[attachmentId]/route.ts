import {
	createStudentCaseAttachmentUrl,
	getStudentCaseAttachment,
	isValidStudentCaseAttachmentUrl,
	studentCaseAttachmentUrlExpiresAt,
	type StudentCaseAttachmentDisposition,
} from "@/features/student/cases/student-case";
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

	return new Response(arrayBufferFromBytes(attachment.bytes), {
		headers: {
			"Cache-Control": "private, max-age=0, no-store",
			"Content-Disposition": `${disposition}; filename="${safeAttachmentFilename(
				attachment.name,
			)}"`,
			"Content-Length": String(attachment.bytes.byteLength),
			"Content-Type": attachment.contentType,
		},
	});
}

function attachmentDispositionFromValue(
	value: string | null,
): StudentCaseAttachmentDisposition | null {
	return value === "inline" || value === "attachment" ? value : null;
}

function arrayBufferFromBytes(bytes: Uint8Array) {
	const body = new ArrayBuffer(bytes.byteLength);

	new Uint8Array(body).set(bytes);

	return body;
}

function safeAttachmentFilename(filename: string) {
	const safe = filename
		.replace(/[^\x20-\x7E]/g, "")
		.replaceAll("\\", "")
		.replaceAll("/", "")
		.replaceAll('"', "")
		.trim();

	return safe || "case-material.pdf";
}
