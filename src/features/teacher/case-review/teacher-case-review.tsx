import { ButtonLink } from "@/components/ui/button";
import {
	studentCaseFeedbackRatingQuestions,
	studentCaseFeedbackSuggestionsQuestion,
	type StudentCaseFeedback,
} from "@/features/case-feedback/feedback";
import type {
	TeacherCaseReview,
	TeacherCaseReviewCompletion,
} from "./case-review";

export function TeacherCaseReviewList({
	caseRecord,
	completions,
}: TeacherCaseReview) {
	return (
		<section
			className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8"
			data-testid="teacher-case-review-root"
		>
			<div className="mb-5 flex flex-col gap-3 border-b border-border-gray pb-5 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase text-muted-gray">
						Case responses
					</p>
					<h1
						className="mt-2 text-xl font-semibold text-primary-text sm:text-2xl"
						data-testid="teacher-case-review-title"
					>
						{caseRecord.title}
					</h1>
					<p className="mt-2 text-sm text-muted-gray">
						Published {formatDateTime(caseRecord.publishedAt)} | Deadline{" "}
						{formatDateTime(caseRecord.deadlineAt)}
					</p>
				</div>
				<ButtonLink href="/teacher/cases" variant="secondary">
					All Cases
				</ButtonLink>
			</div>

			{completions.length > 0 ? (
				<div className="space-y-3" data-testid="teacher-case-review-students">
					{completions.map((completion) => (
						<StudentCompletionCard
							caseId={caseRecord.caseId}
							completion={completion}
							key={completion.studentProfileId}
						/>
					))}
				</div>
			) : (
				<div
					className="border border-border-gray bg-white p-5 text-sm font-semibold text-muted-gray"
					data-testid="teacher-case-review-empty"
				>
					No student completions yet.
				</div>
			)}
		</section>
	);
}

export function TeacherStudentResponseDetail({
	caseRecord,
	completion,
}: {
	caseRecord: TeacherCaseReview["caseRecord"];
	completion: TeacherCaseReviewCompletion;
}) {
	return (
		<section
			className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8"
			data-testid="teacher-student-response-root"
		>
			<div className="mb-5 flex flex-col gap-3 border-b border-border-gray pb-5 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-xs font-semibold uppercase text-muted-gray">
						Student response
					</p>
					<h1
						className="mt-2 text-xl font-semibold text-primary-text sm:text-2xl"
						data-testid="teacher-student-response-student-name"
					>
						{completion.studentDisplayName}
					</h1>
					<p
						className="mt-2 text-sm font-semibold text-muted-gray"
						data-testid="teacher-student-response-case-title"
					>
						{caseRecord.title}
					</p>
				</div>
				<ButtonLink
					href={`/teacher/cases/${encodeURIComponent(caseRecord.caseId)}`}
					variant="secondary"
				>
					Back to Case
				</ButtonLink>
			</div>

			<div className="max-w-sm">
				<StatusTile
					label="Completed"
					testId="teacher-student-response-completed-at"
					value={formatDateTime(completion.completedAt)}
				/>
			</div>

			<div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
				<article className="border border-border-gray bg-white p-5 sm:p-6">
					<h2 className="text-base font-semibold text-primary-text">
						Final Locked Personal Analysis
					</h2>
					<p
						className="mt-4 whitespace-pre-wrap text-sm leading-7 text-primary-text"
						data-testid="teacher-student-response-analysis"
					>
						{completion.personalAnalysis}
					</p>
				</article>

				<FeedbackPanel
					feedback={completion.feedback}
					studentDisplayName={completion.studentDisplayName}
				/>
			</div>
		</section>
	);
}

function StudentCompletionCard({
	caseId,
	completion,
}: {
	caseId: string;
	completion: TeacherCaseReviewCompletion;
}) {
	return (
		<article
			className="border border-border-gray bg-white p-4 text-primary-text sm:p-5"
			data-testid="teacher-case-review-student-card"
		>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h2
						className="text-base font-semibold"
						data-testid="teacher-case-review-student-name"
					>
						{completion.studentDisplayName}
					</h2>
					<p className="mt-1 text-sm text-muted-gray">
						Completed {formatDateTime(completion.completedAt)}
					</p>
				</div>

				<div className="text-sm sm:w-40 lg:ml-auto">
					<StatusPill
						label="Feedback"
						testId="teacher-case-review-feedback-status"
						value={completion.feedback ? "Left" : "Not Left"}
					/>
				</div>

				<ButtonLink
					className="w-full sm:w-auto"
					data-testid="teacher-case-review-open-response"
					href={`/teacher/cases/${encodeURIComponent(
						caseId,
					)}/students/${encodeURIComponent(completion.studentProfileId)}`}
					size="sm"
					variant="secondary"
				>
					View Response
				</ButtonLink>
			</div>
		</article>
	);
}

function FeedbackPanel({
	feedback,
	studentDisplayName,
}: {
	feedback?: StudentCaseFeedback;
	studentDisplayName: string;
}) {
	return (
		<aside
			className="border border-border-gray bg-soft-section p-5 sm:p-6"
			data-testid="teacher-student-response-feedback"
		>
			{feedback ? (
				<>
					<h2 className="text-base font-semibold text-primary-text">
						{possessiveFirstNameFromDisplayName(studentDisplayName)} Feedback
					</h2>
					<div className="mt-4 space-y-3">
						{studentCaseFeedbackRatingQuestions.map((question) => {
							const rating = feedback.ratings?.[question.id];

							return rating ? (
								<div
									className="border border-border-gray bg-white p-3"
									data-testid="teacher-student-response-feedback-rating"
									key={question.id}
								>
									<p className="text-sm leading-5 text-muted-gray">
										{question.question}
									</p>
									<p className="mt-2 text-sm font-semibold text-primary-text">
										{rating} / 5
									</p>
								</div>
							) : null;
						})}
					</div>
					{feedback.futureSuggestions ? (
						<div
							className="mt-4 border border-border-gray bg-white p-3"
							data-testid="teacher-student-response-feedback-comment"
						>
							<p className="text-xs font-semibold uppercase text-muted-gray">
								{studentCaseFeedbackSuggestionsQuestion}
							</p>
							<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary-text">
								{feedback.futureSuggestions}
							</p>
						</div>
					) : null}
				</>
			) : (
				<p
					className="mt-3 text-sm leading-6 text-muted-gray"
					data-testid="teacher-student-response-no-feedback"
				>
					No feedback was submitted
				</p>
			)}
		</aside>
	);
}

function possessiveFirstNameFromDisplayName(displayName: string) {
	const firstName = displayName.trim().split(/\s+/)[0] || "Student";

	return `${firstName}'s`;
}

function StatusTile({
	label,
	testId,
	value,
}: {
	label: string;
	testId: string;
	value: string;
}) {
	return (
		<div className="border border-border-gray bg-white p-4">
			<p className="text-xs font-semibold uppercase text-muted-gray">{label}</p>
			<p className="mt-2 text-sm font-semibold text-primary-text" data-testid={testId}>
				{value}
			</p>
		</div>
	);
}

function StatusPill({
	label,
	testId,
	value,
}: {
	label: string;
	testId: string;
	value: string;
}) {
	return (
		<div className="border border-border-gray bg-app-canvas px-3 py-2">
			<p className="text-xs font-semibold uppercase text-muted-gray">{label}</p>
			<p className="mt-1 font-semibold text-primary-text" data-testid={testId}>
				{value}
			</p>
		</div>
	);
}

function formatDateTime(epochMilliseconds: number) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		timeZone: "Asia/Dubai",
		timeZoneName: "short",
		year: "numeric",
	}).format(new Date(epochMilliseconds));
}
