import { buttonVariants } from "@/components/ui/button";
import { getStudentCertificateHistory } from "@/features/student/dashboard/summary";
import { formatDubaiDate } from "@/lib/date-format";
import { requireStudentSession } from "@/lib/auth/session";

export default async function StudentCertificatesPage() {
	const { profile } = await requireStudentSession();
	const certificates = await getStudentCertificateHistory(profile.profileId);

	return (
		<section
			className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
			data-testid="student-certificates-root"
		>
			<div className="mb-6">
				<p className="text-sm font-semibold uppercase text-brand-teal">
					Certificates
				</p>
				<h1 className="mt-3 text-2xl font-semibold">Certificate history</h1>
			</div>

			{certificates.length > 0 ? (
				<div className="grid gap-4 sm:grid-cols-2">
					{certificates.map((certificate) => (
						<article
							className="border border-primary-action bg-white p-5"
							data-testid="student-certificate-history-card"
							id={`certificate-${certificate.certificateId}`}
							key={certificate.certificateId}
						>
							<p className="text-xs font-semibold uppercase text-brand-teal">
								Certificate
							</p>
							<h2 className="mt-3 text-base font-semibold">
								{certificate.caseTitle}
							</h2>
							<dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
								<div>
									<dt className="text-xs font-semibold uppercase text-muted-gray">
										Earned
									</dt>
									<dd className="mt-1 font-semibold">
										{formatDubaiDate(certificate.completedAt)}
									</dd>
								</div>
								<div>
									<dt className="text-xs font-semibold uppercase text-muted-gray">
										Name on certificate
									</dt>
									<dd className="mt-1 font-semibold">
										{certificate.studentDisplayName}
									</dd>
								</div>
							</dl>
							<a
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
						</article>
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
