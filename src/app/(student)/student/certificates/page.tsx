import { buttonVariants } from "@/components/ui/button";
import { StudentCertificatePreview } from "@/features/student/certificates/certificate-preview";
import {
	getStudentCertificateHistory,
	type StudentDashboardCertificate,
} from "@/features/student/dashboard/summary";
import { formatDubaiDate } from "@/lib/date-format";
import { requireStudentSession } from "@/lib/auth/session";

export default async function StudentCertificatesPage() {
	const { profile } = await requireStudentSession();
	const certificates = await getStudentCertificateHistory(profile.profileId);

	return (
		<section
			className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10"
			data-testid="student-certificates-root"
		>
			<div className="mb-6">
				<h1 className="text-sm font-semibold uppercase text-brand-teal">
					Certificate History
				</h1>
			</div>

			{certificates.length > 0 ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{certificates.map((certificate) => (
						<CertificateHistoryCard
							certificate={certificate}
							key={certificate.certificateId}
						/>
					))}
				</div>
			) : (
				<div
					className="rounded border border-border-gray bg-white p-6"
					data-testid="student-certificates-empty"
				>
					<h2 className="text-base font-semibold">No certificates yet</h2>
					<p className="mt-2 text-sm leading-6 text-muted-gray">
						Certificate records will appear here after completed CME quizzes.
					</p>
				</div>
			)}
		</section>
	);
}

function CertificateHistoryCard({
	certificate,
}: {
	certificate: StudentDashboardCertificate;
}) {
	const completedDate = formatDubaiDate(certificate.completedAt);

	return (
		<article
			aria-labelledby={`certificate-title-${certificate.certificateId}`}
			className="border border-border-gray bg-white p-3 sm:p-4"
			data-testid="student-certificate-history-card"
			id={`certificate-${certificate.certificateId}`}
		>
			<StudentCertificatePreview
				certificate={certificate}
				density="compact"
			/>
			<div className="mt-4">
				<h2
					className="text-base font-semibold"
					id={`certificate-title-${certificate.certificateId}`}
				>
					{certificate.caseTitle}
				</h2>
				<dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
					<div>
						<dt className="text-xs font-semibold uppercase text-muted-gray">
							Earned
						</dt>
						<dd className="mt-1 font-semibold">{completedDate}</dd>
					</div>
				</dl>
				<a
					aria-label={`Download certificate for ${certificate.caseTitle}`}
					className={buttonVariants({
						className: "mt-5",
						size: "sm",
					})}
					data-testid="student-certificate-history-download-link"
					download
					href={`/student/certificates/${certificate.certificateId}/download`}
				>
					Download
				</a>
			</div>
		</article>
	);
}
