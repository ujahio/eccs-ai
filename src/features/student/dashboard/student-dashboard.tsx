import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
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

			<div className="flex flex-col gap-5">
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
	const hasActiveCase = activeCase !== null;
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
		<div>
			{hasActiveCase ? (
				<p
					className="mb-3 text-xs font-semibold uppercase text-primary-text"
					data-testid="student-active-case-kicker"
				>
					Ongoing Case Study
				</p>
			) : null}
			<article className={panelClasses} style={panelStyle}>
				<div className="relative z-10 flex w-full flex-col justify-between">
					{activeCase ? (
						<div
							className="flex flex-1 flex-col gap-8 sm:justify-between lg:flex-row lg:items-center"
							data-testid="student-active-case-banner"
						>
							<div className="max-w-2xl">
								<ActiveCaseIcon />
								<h2
									className="mt-5 text-base font-semibold leading-snug sm:text-lg"
									data-testid="student-active-case-title"
								>
									{activeCase.title}
								</h2>
								<p
									className="mt-3 text-sm leading-6 text-white/90 sm:text-base sm:leading-7"
									data-testid="student-active-case-description"
								>
									{activeCase.description}
								</p>
								<p
									className="mt-8 text-sm leading-6 text-white/90"
									data-testid="student-active-case-expiration"
								>
									<span className="font-semibold text-white">Deadline:</span>{" "}
									{formatDubaiDate(activeCase.deadlineAt)} UAE
								</p>
							</div>
							<Button
								aria-label={`View case study for ${activeCase.title}`}
								className="w-full bg-white px-6 text-primary-text hover:border-white hover:bg-white hover:text-primary-text sm:w-auto"
								data-testid="student-active-case-cta"
								size="md"
								variant="secondary"
							>
								View Case Study
							</Button>
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
		</div>
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

function ActiveCaseIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-10 w-9 text-white/80 sm:h-[52px] sm:w-[45px]"
			focusable="false"
			viewBox="0 0 44.604 51.855"
		>
			<g transform="translate(16661.051 -9005.123)">
				<path
					d="M55.665,6.439H28.327V5.748A.754.754,0,0,0,27.636,5H21.881a.762.762,0,0,0-.748.748V6.5H13.939A1.425,1.425,0,0,0,12.5,7.935V55.416a1.425,1.425,0,0,0,1.439,1.439H55.665A1.425,1.425,0,0,0,57.1,55.416V7.878A1.425,1.425,0,0,0,55.665,6.439Zm-28.776,0V17.662l-1.669-1.669a.857.857,0,0,0-.518-.23.7.7,0,0,0-.518.23l-1.611,1.669V6.439ZM15.378,9.316h2.187v44.6H15.378Zm38.848,44.6H19V9.316H21.19V19.388a.748.748,0,0,0,.46.691.713.713,0,0,0,.806-.173l2.36-2.36,2.36,2.36a.857.857,0,0,0,.518.23.519.519,0,0,0,.288-.058.9.9,0,0,0,.345-.691V9.316h25.9Z"
					fill="currentColor"
					transform="translate(-16673.551 9000.123)"
				/>
				<path
					d="M36.948,38.452a.762.762,0,0,0-.748.748v5.755a.762.762,0,0,0,.748.748h6.5v6.5a.762.762,0,0,0,.748.748h5.755a.762.762,0,0,0,.748-.748V45.646h6.5a.762.762,0,0,0,.748-.748V39.142a.762.762,0,0,0-.748-.748H50.646V31.948A.762.762,0,0,0,49.9,31.2H44.142a.762.762,0,0,0-.748.748v6.5Zm7.194,1.439a.762.762,0,0,0,.748-.748V32.7h4.316v6.446a.762.762,0,0,0,.748.748h6.5v4.316H49.9a.762.762,0,0,0-.748.748v6.5H44.833V44.9a.762.762,0,0,0-.748-.748H37.7V39.833h6.446Z"
					fill="currentColor"
					transform="translate(-16683.611 8991.001)"
				/>
			</g>
		</svg>
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
