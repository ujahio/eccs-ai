import { NextResponse } from "next/server";
import { getE2ECaseMaterial } from "@/lib/e2e/in-memory-auth";
import { rejectNonE2EMode } from "@/lib/e2e/route-helpers";

export async function GET(request: Request) {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return modeResponse;
	}

	const url = new URL(request.url);
	const storageKey = url.searchParams.get("storageKey") ?? "";
	const disposition = attachmentDispositionFromValue(
		url.searchParams.get("disposition"),
	);
	const material = getE2ECaseMaterial(storageKey);

	if (!material || !disposition) {
		return NextResponse.json({ error: "Case material not found." }, { status: 404 });
	}

	return new Response(arrayBufferFromBytes(material.bytes), {
		headers: {
			"Cache-Control": "private, max-age=0, no-store",
			"Content-Disposition": `${disposition}; filename="${safeAttachmentFilename(
				material.name,
			)}"`,
			"Content-Length": String(material.bytes.byteLength),
			"Content-Type": material.contentType,
		},
	});
}

function attachmentDispositionFromValue(value: string | null) {
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
