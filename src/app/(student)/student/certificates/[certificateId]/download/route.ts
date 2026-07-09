import { getStudentCertificateById } from "@/features/student/dashboard/summary";
import { formatDubaiDate } from "@/lib/date-format";
import { requireStudentSession } from "@/lib/auth/session";

type CertificateDownloadRouteContext = {
	params: Promise<{
		certificateId: string;
	}>;
};

export async function GET(
	_request: Request,
	{ params }: CertificateDownloadRouteContext,
) {
	const { profile } = await requireStudentSession();
	const { certificateId } = await params;
	const certificate = await getStudentCertificateById(
		profile.profileId,
		certificateId,
	);

	if (!certificate) {
		return new Response("Certificate not found.", { status: 404 });
	}

	const pdf = certificatePdfBytes({
		certificateId: certificate.certificateId,
		caseTitle: certificate.caseTitle,
		completedAt: certificate.completedAt,
		studentDisplayName: certificate.studentDisplayName,
	});

	return new Response(pdf, {
		headers: {
			"Content-Disposition": `attachment; filename="${safeCertificateFilename(
				certificate.caseTitle,
			)}.pdf"`,
			"Content-Type": "application/pdf",
		},
	});
}

function certificatePdfBytes({
	certificateId,
	caseTitle,
	completedAt,
	studentDisplayName,
}: {
	certificateId: string;
	caseTitle: string;
	completedAt: number;
	studentDisplayName: string;
}) {
	const lines = [
		"E-Clinical Case Solutions",
		"Certificate of Completion",
		`Awarded to ${studentDisplayName}`,
		`For completing ${caseTitle}`,
		`Completed ${formatDubaiDate(completedAt)}`,
		`Certificate ID ${certificateId}`,
	];
	const stream = [
		"BT",
		"/F1 20 Tf",
		"72 720 Td",
		...lines.flatMap((line, index) => [
			index === 0 ? "" : "0 -34 Td",
			`(${escapePdfText(line)}) Tj`,
		]),
		"ET",
	]
		.filter(Boolean)
		.join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
	];
	let body = "%PDF-1.4\n";
	const offsets = [0];

	for (const [index, object] of objects.entries()) {
		offsets.push(body.length);
		body += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}

	const xrefOffset = body.length;
	body += `xref\n0 ${objects.length + 1}\n`;
	body += "0000000000 65535 f \n";
	for (const offset of offsets.slice(1)) {
		body += `${offset.toString().padStart(10, "0")} 00000 n \n`;
	}
	body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
	body += `startxref\n${xrefOffset}\n%%EOF`;

	return new TextEncoder().encode(body);
}

function escapePdfText(value: string) {
	return value
		.replace(/[^\x20-\x7E]/g, "?")
		.replaceAll("\\", "\\\\")
		.replaceAll("(", "\\(")
		.replaceAll(")", "\\)");
}

function safeCertificateFilename(caseTitle: string) {
	const slug = caseTitle
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 48);

	return `certificate-${slug || "download"}`;
}
