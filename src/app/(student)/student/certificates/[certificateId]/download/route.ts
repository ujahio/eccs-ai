import { getStudentCertificateById } from "@/features/student/dashboard/summary";
import {
	certificatePdfBytes,
	safeCertificateFilename,
} from "@/features/student/certificates/certificate-pdf";
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
		certificateBranding: certificate.certificateBranding,
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
