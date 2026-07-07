import { ButtonLink } from "@/components/ui/button";

type TeacherDashboardCase = {
	caseId: string;
	title: string;
	publishedAt: number;
	deadlineAt: number;
	archivedAt?: number;
	completionCount: number;
	feedbackCount: number;
};

type TeacherDashboardReviewProps = {
	activeCase: TeacherDashboardCase | null;
	archivedCases: TeacherDashboardCase[];
};

export function TeacherDashboardReview({
	activeCase,
	archivedCases,
}: TeacherDashboardReviewProps) {
	const startCaseLabel = activeCase ? "Start a draft case" : "Start a New Case";
	const hasActiveCase = activeCase !== null;
	const activeCasePanelClasses = [
		"relative overflow-hidden rounded border border-border-gray p-5 sm:p-6",
		hasActiveCase
			? "bg-primary-action bg-[length:auto_100%] bg-[position:70%_center] bg-no-repeat text-white sm:bg-cover sm:bg-center"
			: "bg-white text-primary-text",
	].join(" ");
	const activeCasePanelStyle = hasActiveCase
		? {
				backgroundImage:
					"linear-gradient(90deg, rgba(6, 18, 31, 0.66), rgba(6, 47, 55, 0.38)), url('/images/ongoing-case-bg.png')",
			}
		: undefined;

	return (
		<section
			className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
			data-testid="teacher-dashboard-root"
		>
			<div className="mb-5 flex justify-end sm:mb-6">
				<ButtonLink
					data-testid="teacher-start-case-button"
					href="/teacher/cases/new"
					title={startCaseLabel}
				>
					{startCaseLabel}
				</ButtonLink>
			</div>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
				<div>
					<p
						aria-hidden={!hasActiveCase}
						className={[
							"mb-3 min-h-4 text-xs font-semibold uppercase",
							hasActiveCase ? "text-muted-gray" : "text-transparent",
						].join(" ")}
					>
						Ongoing case study
					</p>
					<div className={activeCasePanelClasses} style={activeCasePanelStyle}>
						<div className="relative z-10">
							{activeCase ? (
								<div data-testid="teacher-active-case-card">
									<div
										className="flex min-h-24 items-center gap-4 text-white sm:gap-5"
										data-testid="teacher-active-case-title"
									>
										<ActiveCaseIcon isDark />
										<span className="max-w-md text-xl font-semibold leading-snug sm:text-2xl">
											{activeCase.title}
										</span>
									</div>
									<ActiveCaseMetrics caseRecord={activeCase} />
								</div>
							) : (
								<>
									<div className="mb-5 border-b border-border-gray pb-4">
										<ActiveCaseIcon isDark={false} />
									</div>
									<EmptyState
										body="Publish a case study to make it available to students."
										testId="teacher-dashboard-no-active-case"
										title="No active case"
									/>
								</>
							)}
						</div>
					</div>
				</div>

				<div className="rounded border border-border-gray bg-white p-5 sm:p-6 lg:mt-7">
					<div className="mb-1 border-b border-border-gray pb-4">
						<p className="text-xs font-semibold uppercase text-muted-gray">
							Recent archived cases
						</p>
					</div>

					{archivedCases.length > 0 ? (
						<div data-testid="teacher-archived-cases">
							{archivedCases.map((caseRecord) => (
								<ArchivedCaseRow
									caseRecord={caseRecord}
									key={caseRecord.caseId}
								/>
							))}
						</div>
					) : (
						<EmptyState
							testId="teacher-dashboard-no-archived-cases"
							title="No archived cases"
						/>
					)}
				</div>
			</div>
		</section>
	);
}

function ActiveCaseIcon({ isDark }: { isDark: boolean }) {
	return (
		<svg
			aria-hidden="true"
			className={[
				"h-10 w-9 shrink-0 sm:h-[52px] sm:w-[45px]",
				isDark ? "text-white/75" : "text-brand-teal",
			].join(" ")}
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

function ActiveCaseMetrics({
	caseRecord,
}: {
	caseRecord: TeacherDashboardCase;
}) {
	return (
		<dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-white/20 pt-5 sm:grid-cols-4">
			<Metric
				label="Published"
				testId="teacher-active-case-publish-date"
				value={formatDate(caseRecord.publishedAt)}
			/>
			<Metric
				label="Deadline"
				testId="teacher-active-case-deadline"
				value={formatDate(caseRecord.deadlineAt)}
			/>
			<Metric
				label="Student completions"
				testId="teacher-active-case-completions"
				value={caseRecord.completionCount.toString()}
			/>
			<Metric
				label="Feedback"
				testId="teacher-active-case-feedback"
				value={caseRecord.feedbackCount.toString()}
			/>
		</dl>
	);
}

function ArchivedCaseRow({ caseRecord }: { caseRecord: TeacherDashboardCase }) {
	return (
		<article
			className="border-b border-border-gray py-4"
			data-testid="teacher-archived-case-card"
		>
			<h3 className="text-base font-semibold">{caseRecord.title}</h3>
			<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
				<CompactMetric
					label="Archived"
					value={formatDate(caseRecord.archivedAt ?? caseRecord.deadlineAt)}
				/>
				<CompactMetric
					label="Completed"
					value={caseRecord.completionCount.toString()}
				/>
				<CompactMetric
					label="Feedback"
					value={caseRecord.feedbackCount.toString()}
				/>
			</div>
		</article>
	);
}

function Metric({
	label,
	testId,
	value,
}: {
	label: string;
	testId: string;
	value: string;
}) {
	return (
		<div>
			<dt className="text-xs font-semibold uppercase text-white/70">{label}</dt>
			<dd className="mt-2 text-base font-semibold" data-testid={testId}>
				{value}
			</dd>
		</div>
	);
}

function CompactMetric({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs font-semibold uppercase text-muted-gray">{label}</p>
			<p className="mt-1 font-semibold">{value}</p>
		</div>
	);
}

function EmptyState({
	body,
	testId,
	title,
	tone = "light",
}: {
	body?: string;
	testId: string;
	title: string;
	tone?: "dark" | "light";
}) {
	const isDark = tone === "dark";

	return (
		<div
			className={[
				"flex min-h-48 flex-col justify-center p-5",
				isDark ? "bg-white/10" : "bg-app-canvas",
			].join(" ")}
			data-testid={testId}
		>
			<h3 className="text-base font-semibold">{title}</h3>
			{body ? (
				<p
					className={[
						"mt-2 text-sm leading-6",
						isDark ? "text-white/80" : "text-muted-gray",
					].join(" ")}
				>
					{body}
				</p>
			) : null}
		</div>
	);
}

function formatDate(epochMilliseconds: number) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Asia/Dubai",
	}).format(new Date(epochMilliseconds));
}
