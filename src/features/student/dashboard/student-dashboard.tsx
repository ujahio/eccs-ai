import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { formatDubaiDate } from "@/lib/date-format";
import type {
	StudentDashboardActiveCase,
	StudentDashboardCertificate,
} from "./summary";

type StudentDashboardProps = {
	activeCase: StudentDashboardActiveCase | null;
	recentCertificates: StudentDashboardCertificate[];
	studentName: string;
};

export function StudentDashboard({
	activeCase,
	recentCertificates,
	studentName,
}: StudentDashboardProps) {
	const firstName = firstNameFromFullName(studentName);

	return (
		<section
			className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
			data-testid="student-dashboard-root"
		>
			<div className="mb-6">
				<h1
					className="text-2xl font-semibold"
					data-testid="student-dashboard-heading"
				>
					Welcome back, {firstName}
				</h1>
			</div>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
				<ActiveCasePanel activeCase={activeCase} />
				<RecentCertificates certificates={recentCertificates} />
			</div>
		</section>
	);
}

function ActiveCasePanel({
	activeCase,
}: {
	activeCase: StudentDashboardActiveCase | null;
}) {
	const panelClasses = [
		"relative flex min-h-72 overflow-hidden rounded border border-border-gray p-5 sm:p-6",
		activeCase
			? "bg-primary-action bg-[length:auto_100%] bg-[position:70%_center] bg-no-repeat text-white sm:bg-cover sm:bg-center"
			: "bg-white text-primary-text",
	].join(" ");
	const panelStyle = activeCase
		? {
				backgroundImage:
					"linear-gradient(90deg, rgba(6, 18, 31, 0.7), rgba(6, 47, 55, 0.42)), url('/images/ongoing-case-bg.png')",
			}
		: undefined;

	return (
		<article className={panelClasses} style={panelStyle}>
			<div className="relative z-10 flex w-full flex-col justify-between">
				{activeCase ? (
					<div data-testid="student-active-case-banner">
						<p className="text-xs font-semibold uppercase text-white/75">
							Active case
						</p>
						<h2
							className="mt-5 max-w-xl text-2xl font-semibold leading-snug sm:text-3xl"
							data-testid="student-active-case-title"
						>
							{activeCase.title}
						</h2>
						<dl className="mt-6 border-t border-white/20 pt-5">
							<div>
								<dt className="text-xs font-semibold uppercase text-white/70">
									Expires
								</dt>
								<dd
									className="mt-2 text-base font-semibold"
									data-testid="student-active-case-expiration"
								>
									{formatDubaiDate(activeCase.deadlineAt)} UAE
								</dd>
							</div>
						</dl>
					</div>
				) : (
					<div
						className="flex flex-1 flex-col justify-center bg-app-canvas p-5"
						data-testid="student-dashboard-no-active-case"
					>
						<p className="text-xs font-semibold uppercase text-brand-teal">
							Case studies
						</p>
						<h2 className="mt-3 text-xl font-semibold">
							No active case available
						</h2>
						<p className="mt-3 max-w-md text-sm leading-6 text-muted-gray">
							Your account is active. Check back when the next case is
							published.
						</p>
					</div>
				)}
			</div>
		</article>
	);
}

function RecentCertificates({
	certificates,
}: {
	certificates: StudentDashboardCertificate[];
}) {
	return (
		<aside className="rounded border border-border-gray bg-white p-5 sm:p-6">
			<div className="mb-1 border-b border-border-gray pb-4">
				<p className="text-xs font-semibold uppercase text-muted-gray">
					Recent certificates
				</p>
			</div>

			{certificates.length > 0 ? (
				<div data-testid="student-recent-certificates">
					{certificates.map((certificate) => (
						<CertificateRow
							certificate={certificate}
							key={certificate.certificateId}
						/>
					))}
					<ButtonLink
						className="mt-5"
						data-testid="student-view-all-certificates-link"
						href="/student/certificates"
						size="sm"
						variant="secondary"
					>
						View All
					</ButtonLink>
				</div>
			) : (
				<div
					className="flex min-h-52 flex-col justify-center bg-app-canvas p-5"
					data-testid="student-dashboard-no-certificates"
				>
					<h2 className="text-base font-semibold">No certificates yet</h2>
					<p className="mt-2 text-sm leading-6 text-muted-gray">
						Completed CME quizzes will add certificate records here.
					</p>
				</div>
			)}
		</aside>
	);
}

function CertificateRow({
	certificate,
}: {
	certificate: StudentDashboardCertificate;
}) {
	return (
		<article
			className="my-4 border border-primary-action bg-white p-4"
			data-testid="student-recent-certificate-card"
		>
			<p className="text-xs font-semibold uppercase text-brand-teal">
				Certificate
			</p>
			<h3 className="mt-3 text-base font-semibold">{certificate.caseTitle}</h3>
			<p className="mt-2 text-sm text-muted-gray">
				Earned {formatDubaiDate(certificate.completedAt)}
			</p>
			<div className="mt-4 flex flex-wrap gap-3">
				<ButtonLink
					data-testid="student-certificate-view-link"
					href={`/student/certificates#certificate-${certificate.certificateId}`}
					size="sm"
					variant="secondary"
				>
					View
				</ButtonLink>
				<a
					aria-label={`Download certificate for ${certificate.caseTitle}`}
					className={buttonVariants({ size: "sm" })}
					data-testid="student-certificate-download-link"
					download
					href={`/student/certificates/${certificate.certificateId}/download`}
				>
					Download
				</a>
			</div>
		</article>
	);
}

function firstNameFromFullName(fullName: string) {
	return fullName.trim().split(/\s+/)[0] || "there";
}
