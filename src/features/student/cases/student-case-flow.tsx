"use client";

import {
	type FormEvent,
	useEffect,
	useMemo,
	useState,
	useTransition,
} from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatDubaiDate } from "@/lib/date-format";
import {
	countAnalysisWords,
	maximumAnalysisWordCount,
	minimumAnalysisWordCount,
	validateAnalysisWordCount,
} from "./analysis";
import { quizOptionLabel, shuffleStudentCaseQuizQuestions } from "./quiz";
import {
	initialStudentCaseQuizFormState,
	type StudentCaseQuizAction,
} from "./state";
import type { StudentCasePresentation } from "./student-case";

type StudentCaseFlowProps = {
	caseRecord: StudentCasePresentation;
	quizAction: StudentCaseQuizAction;
};

type CaseFlowStep =
	| "presentation"
	| "analysis"
	| "comparison"
	| "resources"
	| "quiz"
	| "certificate";
type AnalysisReviewMode = "both" | "personalAnalysis" | "modelAnswer";

const analysisReviewOptions: Array<{
	label: string;
	mode: AnalysisReviewMode;
	testId: string;
}> = [
	{ label: "Both", mode: "both", testId: "student-case-review-mode-both" },
	{
		label: "Personal Analysis",
		mode: "personalAnalysis",
		testId: "student-case-review-mode-personal-analysis",
	},
	{
		label: "Model Answer",
		mode: "modelAnswer",
		testId: "student-case-review-mode-model-answer",
	},
];

const stepCopy: Record<
	CaseFlowStep,
	{
		heading: string;
		description: string;
	}
> = {
	presentation: {
		heading: "Case Presentation",
		description:
			"Review the clinical presentation, then continue to submit your analysis.",
	},
	analysis: {
		heading: "Personal Analysis",
		description: "Write your clinical reasoning before continuing.",
	},
	comparison: {
		heading: "Analysis Review",
		description:
			"Compare your clinical reasoning with the teacher's model answer.",
	},
	resources: {
		heading: "Teaching Resources",
		description: "Review the lecture text and case materials before continuing.",
	},
	quiz: {
		heading: "CME Quiz",
		description: "Answer every question correctly to earn your certificate.",
	},
	certificate: {
		heading: "Certificate",
		description: "Your certificate is ready for download.",
	},
};

const expiredMessage =
	"This case is no longer active. Return to your dashboard for the current case status.";
const deadlineReminderWindowMilliseconds = 2 * 24 * 60 * 60 * 1_000;

export function StudentCaseFlow({
	caseRecord,
	quizAction,
}: StudentCaseFlowProps) {
	const [step, setStep] = useState<CaseFlowStep>("presentation");
	const [analysisText, setAnalysisText] = useState("");
	const [submittedAnalysis, setSubmittedAnalysis] = useState("");
	const [analysisReviewMode, setAnalysisReviewMode] =
		useState<AnalysisReviewMode>("both");
	const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
	const [quizFailuresSinceReview, setQuizFailuresSinceReview] = useState(0);
	const [showLeaveQuizDialog, setShowLeaveQuizDialog] = useState(false);
	const [reviewRequired, setReviewRequired] = useState(false);
	const [message, setMessage] = useState("");
	const [isExpired, setIsExpired] = useState(
		() => Date.now() > caseRecord.deadlineAt,
	);
	const [quizState, setQuizState] = useState(initialStudentCaseQuizFormState);
	const [isQuizPending, startQuizSubmission] = useTransition();
	const wordCount = useMemo(
		() => countAnalysisWords(analysisText),
		[analysisText],
	);
	const quizQuestions = useMemo(
		() =>
			shuffleStudentCaseQuizQuestions(
				caseRecord.cmeQuestions,
				`${caseRecord.caseId}:${caseRecord.deadlineAt}`,
			),
		[caseRecord.caseId, caseRecord.cmeQuestions, caseRecord.deadlineAt],
	);
	const validation = validateAnalysisWordCount(analysisText);
	const isAnalysisValid = validation.valid;
	const currentStepCopy = stepCopy[step];
	const visibleMessage = isExpired ? expiredMessage : message;
	const showPersonalAnalysis = analysisReviewMode !== "modelAnswer";
	const showModelAnswer = analysisReviewMode !== "personalAnalysis";
	const hasAllQuizAnswers =
		quizQuestions.length > 0 &&
		quizQuestions.every((question) => Boolean(quizAnswers[question.questionId]));
	const hasPassedQuiz = quizState.status === "passed";
	const shouldWarnBeforeLeavingQuiz = step === "quiz" && !hasPassedQuiz;
	const isDeadlineInReminderWindow = isDeadlineWithinReminderWindow(
		caseRecord.deadlineAt,
		isExpired,
	);

	useEffect(() => {
		if (isExpired) {
			return;
		}

		function expireIfNeeded() {
			if (Date.now() > caseRecord.deadlineAt) {
				setIsExpired(true);
				setMessage(expiredMessage);
			}
		}

		const millisecondsUntilDeadline = Math.max(
			0,
			caseRecord.deadlineAt - Date.now() + 1,
		);
		const timeoutId = window.setTimeout(
			expireIfNeeded,
			millisecondsUntilDeadline,
		);
		const intervalId = window.setInterval(expireIfNeeded, 1_000);

		return () => {
			window.clearTimeout(timeoutId);
			window.clearInterval(intervalId);
		};
	}, [caseRecord.deadlineAt, isExpired]);

	useEffect(() => {
		if (!shouldWarnBeforeLeavingQuiz) {
			return;
		}

		function warnBeforeUnload(event: BeforeUnloadEvent) {
			event.preventDefault();
			event.returnValue = "";
		}

		window.addEventListener("beforeunload", warnBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", warnBeforeUnload);
		};
	}, [shouldWarnBeforeLeavingQuiz]);

	function isDeadlineExpired() {
		return isExpired || Date.now() > caseRecord.deadlineAt;
	}

	function guardActiveCase() {
		if (!isDeadlineExpired()) {
			return true;
		}

		setMessage(expiredMessage);
		setIsExpired(true);
		return false;
	}

	function continueToAnalysis() {
		if (!guardActiveCase()) {
			return;
		}

		if (reviewRequired && submittedAnalysis) {
			setMessage("");
			setStep("comparison");
			return;
		}

		setMessage("");
		setStep("analysis");
	}

	function submitAnalysis(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!guardActiveCase()) {
			return;
		}

		const result = validateAnalysisWordCount(analysisText);

		if (!result.valid) {
			setMessage(result.message);
			return;
		}

		const trimmedAnalysis = analysisText.trim();
		setAnalysisText(trimmedAnalysis);
		setSubmittedAnalysis(trimmedAnalysis);
		setAnalysisReviewMode("both");
		setMessage("");
		setStep("comparison");
	}

	function editAnalysis() {
		if (!guardActiveCase()) {
			return;
		}

		setAnalysisText(submittedAnalysis);
		setMessage("");
		setStep("analysis");
	}

	function returnToPresentation() {
		if (!guardActiveCase()) {
			return;
		}

		setMessage("");
		setStep("presentation");
	}

	function continueToResources() {
		if (!guardActiveCase()) {
			return;
		}

		setMessage("");
		setStep("resources");
	}

	function returnToComparison() {
		if (!guardActiveCase()) {
			return;
		}

		setMessage("");
		setStep("comparison");
	}

	function continueToQuiz() {
		if (!guardActiveCase()) {
			return;
		}

		if (quizQuestions.length < 3) {
			setMessage("This case does not have an available CME quiz.");
			return;
		}

		setReviewRequired(false);
		setMessage("");
		setStep("quiz");
	}

	function reviewLectureText() {
		if (!guardActiveCase()) {
			return;
		}

		setShowLeaveQuizDialog(false);
		setMessage("");
		setStep("resources");
	}

	function returnToResources() {
		if (!guardActiveCase()) {
			return;
		}

		if (shouldWarnBeforeLeavingQuiz) {
			setShowLeaveQuizDialog(true);
			return;
		}

		leaveQuizForResources();
	}

	function leaveQuizForResources() {
		setShowLeaveQuizDialog(false);
		setMessage("");
		setStep("resources");
	}

	function submitQuiz(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!guardActiveCase()) {
			return;
		}

		if (!hasAllQuizAnswers) {
			setMessage("Answer every CME question before submitting.");
			return;
		}

		const formData = new FormData(event.currentTarget);

		startQuizSubmission(async () => {
			const result = await quizAction(quizState, formData);

			setQuizState(result);
			handleQuizSubmissionResult(result);
		});
	}

	function handleQuizSubmissionResult(result: typeof quizState) {
		if (result.status === "expired") {
			setIsExpired(true);
			setMessage(result.message);
			return;
		}

		if (result.status === "failed") {
			const nextFailureCount = quizFailuresSinceReview + 1;

			if (nextFailureCount >= 3) {
				setQuizFailuresSinceReview(0);
				setReviewRequired(true);
				setAnalysisReviewMode("both");
				setStep("presentation");
				setMessage(
					"Quiz attempt submitted. Result: did not pass. Review the case presentation, model answer, and teaching resources before retrying.",
				);
				return;
			}

			setQuizFailuresSinceReview(nextFailureCount);
			setMessage("");
			return;
		}

		if (result.status === "passed") {
			setMessage("");
			setStep("certificate");
			return;
		}

		if (result.status === "duplicate" || result.status === "error") {
			setMessage("");
		}
	}

	return (
		<section
			className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10"
			data-testid="student-case-flow-root"
		>
			<header className="mb-5 border-b border-border-gray pb-5 sm:mb-7">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-xs font-semibold uppercase text-brand-teal">
						Case Study
					</p>
					<p
						className="text-sm font-semibold text-primary-text"
						data-testid="student-case-deadline"
					>
						<span>Deadline: </span>
						<span
							className={[
								isDeadlineInReminderWindow
									? "border border-error-red bg-[#fff5f5] px-2 py-1 text-error-red"
									: "text-primary-text",
							].join(" ")}
							data-testid="student-case-deadline-date"
						>
							{formatDubaiDate(caseRecord.deadlineAt)}
						</span>
						<span> UAE</span>
					</p>
				</div>
				<h1
					className="mt-3 text-xl font-semibold leading-tight sm:text-2xl"
					data-testid="student-case-flow-heading"
				>
					{currentStepCopy.heading}
				</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-gray sm:text-base">
					{currentStepCopy.description}
				</p>
			</header>

			{visibleMessage ? (
				<p
					className="mb-5 border border-error-red bg-white p-3 text-sm font-medium text-error-red"
					data-testid="student-case-flow-message"
					role="alert"
				>
					{visibleMessage}
				</p>
			) : null}

			{isExpired ? (
				<article
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-expired"
				>
					<h2 className="text-lg font-semibold">Case Closed</h2>
					<p className="mt-3 text-sm leading-6 text-muted-gray">
						{expiredMessage}
					</p>
				</article>
			) : null}

			{!isExpired && step === "presentation" ? (
				<article
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-presentation-step"
				>
					<div
						className="whitespace-pre-wrap text-base leading-8 text-primary-text"
						data-testid="student-case-presentation"
					>
						{caseRecord.presentation}
					</div>
					<div className="mt-7 flex justify-end">
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-continue"
							onClick={continueToAnalysis}
							type="button"
						>
							Continue
						</Button>
					</div>
				</article>
			) : null}

			{!isExpired && step === "analysis" ? (
				<form
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-analysis-form"
					onSubmit={submitAnalysis}
				>
					<div className="flex justify-end">
						<p
							className={[
								"text-sm font-semibold",
								isAnalysisValid ? "text-brand-teal" : "text-muted-gray",
							].join(" ")}
							data-testid="student-case-analysis-word-count"
						>
							{wordCount} / {maximumAnalysisWordCount} words
						</p>
					</div>
					<label
						className="sr-only"
						htmlFor="student-case-analysis"
					>
						Personal Analysis Response
					</label>
					<textarea
						className="mt-3 min-h-72 w-full resize-y border border-border-gray bg-white p-4 text-base leading-7 text-primary-text outline-none transition placeholder:text-muted-gray focus:border-brand-teal"
						data-testid="student-case-analysis"
						id="student-case-analysis"
						name="analysis"
						onChange={(event) => {
							setAnalysisText(event.target.value);
							if (message && !isDeadlineExpired()) {
								setMessage("");
							}
						}}
						placeholder="Enter your clinical reasoning."
						value={analysisText}
					/>
					<p
						className="mt-2 text-sm text-muted-gray"
						data-testid="student-case-analysis-requirements"
					>
						{minimumAnalysisWordCount}-{maximumAnalysisWordCount} words required.
					</p>
					{!isAnalysisValid && wordCount > 0 ? (
						<p
							className="mt-2 text-sm font-medium text-error-red"
							data-testid="student-case-analysis-validation"
						>
							{validation.message}
						</p>
					) : null}
					<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-between">
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-back-to-presentation"
							onClick={returnToPresentation}
							type="button"
							variant="secondary"
						>
							Previous
						</Button>
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-submit-analysis"
							disabled={!isAnalysisValid}
							type="submit"
						>
							{submittedAnalysis ? "Save Revision" : "Submit"}
						</Button>
					</div>
				</form>
			) : null}

			{!isExpired && step === "comparison" ? (
				<article
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-comparison-step"
				>
					<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div
							aria-label="Analysis Review View"
							className="grid w-full grid-cols-1 gap-2 min-[520px]:grid-cols-3 sm:flex sm:w-auto sm:flex-wrap"
							data-testid="student-case-review-mode"
							role="group"
						>
							{analysisReviewOptions.map((option) => {
								const isSelected = analysisReviewMode === option.mode;

								return (
									<button
										aria-pressed={isSelected}
										className={[
											"min-h-11 w-full border px-4 text-xs font-semibold transition sm:w-auto",
											isSelected
												? "border-primary-action bg-primary-action text-white"
												: "border-border-gray bg-white text-primary-text hover:border-primary-action",
										].join(" ")}
										data-testid={option.testId}
										key={option.mode}
										onClick={() => setAnalysisReviewMode(option.mode)}
										type="button"
									>
										{option.label}
									</button>
								);
							})}
						</div>
						<Button
							className="w-full shrink-0 sm:w-auto"
							data-testid="student-case-edit-analysis"
							onClick={editAnalysis}
							size="sm"
							type="button"
							variant="secondary"
						>
							Edit My Analysis
						</Button>
					</div>
					<div
						className={[
							"grid gap-4",
							analysisReviewMode === "both" ? "lg:grid-cols-2" : "",
						].join(" ")}
					>
						{showPersonalAnalysis ? (
							<section
								className="border border-border-gray bg-app-canvas p-4"
								data-testid="student-case-personal-analysis-card"
							>
								<h2 className="text-base font-semibold">Personal Analysis</h2>
								<div
									className="mt-4 whitespace-pre-wrap text-base leading-7 text-primary-text"
									data-testid="student-case-submitted-analysis"
								>
									{submittedAnalysis}
								</div>
							</section>
						) : null}
						{showModelAnswer ? (
							<section
								className="border border-border-gray bg-app-canvas p-4"
								data-testid="student-case-model-answer-card"
							>
								<h2 className="text-base font-semibold">Model Answer</h2>
								<div
									className="mt-4 whitespace-pre-wrap text-base leading-7 text-primary-text"
									data-testid="student-case-model-answer"
								>
									{caseRecord.modelAnswer}
								</div>
							</section>
						) : null}
					</div>
					<div className="mt-7 flex justify-end">
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-continue-to-resources"
							onClick={continueToResources}
							type="button"
						>
							Continue
						</Button>
					</div>
				</article>
			) : null}

			{!isExpired && step === "resources" ? (
				<article
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-resources-step"
				>
					<section>
						<h2 className="text-base font-semibold">Lecture Text</h2>
						<div
							className="mt-4 whitespace-pre-wrap text-base leading-8 text-primary-text"
							data-testid="student-case-lecture-text"
						>
							{caseRecord.lectureText}
						</div>
					</section>

					{caseRecord.attachments.length > 0 ? (
						<section
							className="mt-8"
							data-testid="student-case-pdf-attachments"
						>
							<h2 className="text-base font-semibold">Case Materials</h2>
							<div className="mt-4 space-y-3">
								{caseRecord.attachments.map((attachment) => (
									<section
										className="flex flex-col gap-3 border border-border-gray bg-white p-3 transition hover:border-brand-teal sm:flex-row sm:items-center sm:justify-between"
										data-testid={`student-case-pdf-attachment-${attachment.attachmentId}`}
										key={attachment.attachmentId}
									>
										<a
											aria-label={`Open ${attachment.name} in a new tab`}
											className="group flex min-h-14 flex-1 items-center gap-3 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
											data-testid={`student-case-pdf-open-${attachment.attachmentId}`}
											href={attachment.viewUrl}
											rel="noopener noreferrer"
											target="_blank"
										>
											<span className="flex h-11 w-11 shrink-0 items-center justify-center border border-border-gray bg-app-canvas text-primary-action transition group-hover:border-brand-teal group-hover:text-brand-teal">
												<PdfFileIcon />
											</span>
											<span className="min-w-0">
												<span className="block truncate text-sm font-semibold text-primary-text transition group-hover:text-brand-teal group-hover:underline group-hover:underline-offset-4">
													{attachment.name}
												</span>
												<span className="mt-1 block text-xs text-muted-gray">
													PDF | {formatPdfSize(attachment.size)}
												</span>
											</span>
										</a>
										<a
											aria-label={`Download ${attachment.name}`}
											className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-border-gray bg-white text-primary-text transition hover:border-primary-action hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
											data-testid={`student-case-pdf-download-${attachment.attachmentId}`}
											download={attachment.name}
											href={attachment.downloadUrl}
										>
											<DownloadIcon />
										</a>
									</section>
								))}
							</div>
						</section>
					) : null}

					<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-between">
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-back-to-comparison"
							onClick={returnToComparison}
							type="button"
							variant="secondary"
						>
							Previous
						</Button>
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-continue-to-quiz"
							onClick={continueToQuiz}
							type="button"
						>
							Continue
						</Button>
					</div>
				</article>
			) : null}

			{!isExpired && step === "quiz" ? (
				<form
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-quiz-form"
					onSubmit={submitQuiz}
				>
					<input
						name="caseId"
						type="hidden"
						value={caseRecord.caseId}
					/>
					<div className="mb-5 flex flex-col gap-2 border-b border-border-gray pb-4 sm:flex-row sm:items-center sm:justify-between">
						<p
							className="text-sm font-semibold text-primary-text"
							data-testid="student-case-quiz-progress"
						>
							{Object.keys(quizAnswers).length} of {quizQuestions.length} answered
						</p>
						<p className="text-sm text-muted-gray">
							Passing score: 100%
						</p>
					</div>

					{quizState.status === "failed" ||
					quizState.status === "duplicate" ||
					quizState.status === "error" ? (
						<div
							className={[
								"mb-5 flex flex-col gap-3 border bg-white p-3 text-sm font-medium sm:flex-row sm:items-center sm:justify-between",
								quizState.status === "failed"
									? "border-error-red bg-[#fff5f5] text-primary-text"
									: "border-error-red text-error-red",
							].join(" ")}
							data-testid="student-case-quiz-status"
							role="status"
						>
							<span>{quizState.message}</span>
							{quizState.status === "failed" ? (
								<Button
									className="w-full shrink-0 sm:w-auto"
									data-testid="student-case-review-lecture-text"
									onClick={reviewLectureText}
									size="sm"
									type="button"
									variant="secondary"
								>
									Review Lecture Text
								</Button>
							) : null}
						</div>
					) : null}

					<div className="space-y-5">
						{quizQuestions.map((question, questionIndex) => (
							<section
								className="border border-border-gray bg-app-canvas p-4 sm:p-5"
								data-testid={`student-case-quiz-question-${question.questionId}`}
								key={question.questionId}
							>
								<p className="text-xs font-semibold uppercase text-brand-teal">
									Question {questionIndex + 1}
								</p>
								<h2
									className="mt-3 text-base font-semibold leading-7 text-primary-text"
									data-testid={`student-case-quiz-prompt-${question.questionId}`}
								>
									{question.prompt}
								</h2>
								<div className="mt-4 space-y-3">
									{question.options.map((option, optionIndex) => {
										const isSelected =
											quizAnswers[question.questionId] === option.optionId;

										return (
											<label
												aria-checked={isSelected}
												className={[
													"grid min-h-12 cursor-pointer grid-cols-[40px_minmax(0,1fr)] items-center border bg-white text-sm transition",
													isSelected
														? "border-primary-action bg-soft-section text-primary-text"
														: "border-border-gray text-primary-text hover:border-primary-action",
												].join(" ")}
												data-testid={`student-case-quiz-option-${question.questionId}-${option.optionId}`}
												key={option.optionId}
												role="radio"
											>
												<span
													className={[
														"flex h-full min-h-12 items-center justify-center border-r text-xs font-semibold",
														isSelected
															? "border-primary-action text-primary-action"
															: "border-border-gray text-muted-gray",
													].join(" ")}
												>
													{quizOptionLabel(optionIndex)}
												</span>
												<span className="flex min-h-12 items-center px-4 leading-6">
													<input
														checked={isSelected}
														className="sr-only"
														name={`answer:${question.questionId}`}
														onChange={() => {
															setQuizAnswers((answers) => ({
																...answers,
																[question.questionId]: option.optionId,
															}));
															if (!isDeadlineExpired()) {
																setMessage("");
															}
														}}
														type="radio"
														value={option.optionId}
													/>
													{option.text}
												</span>
											</label>
										);
									})}
								</div>
							</section>
						))}
					</div>

					<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-between">
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-quiz-back-to-resources"
							onClick={returnToResources}
							type="button"
							variant="secondary"
						>
							Previous
						</Button>
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-submit-quiz"
							disabled={!hasAllQuizAnswers || isQuizPending}
							type="submit"
						>
							{isQuizPending ? "Submitting" : "Submit"}
						</Button>
					</div>
				</form>
			) : null}

			{!isExpired && step === "certificate" ? (
				<article
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-certificate-step"
				>
					<div className="mx-auto max-w-2xl text-center">
						<div className="mx-auto flex h-14 w-14 items-center justify-center border border-success-mint bg-success-soft text-primary-action">
							<CheckIcon />
						</div>
						<h2 className="mt-5 text-xl font-semibold text-primary-text">
							Certificate Earned
						</h2>
						<p
							className="mt-3 text-sm leading-6 text-muted-gray"
							data-testid="student-case-certificate-message"
						>
							You passed the CME quiz and earned your certificate for{" "}
							{caseRecord.title}.
						</p>
						<div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
							{quizState.certificateId ? (
								<a
									className="inline-flex h-11 items-center justify-center rounded bg-primary-action px-6 text-sm font-bold uppercase text-white transition hover:bg-success-mint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
									data-testid="student-case-certificate-download"
									download
									href={`/student/certificates/${quizState.certificateId}/download`}
								>
									Download Certificate
								</a>
							) : null}
							<ButtonLink
								data-testid="student-case-certificate-history"
								href="/student/certificates"
								variant="secondary"
							>
								View Certificates
							</ButtonLink>
						</div>
					</div>
				</article>
			) : null}

			{showLeaveQuizDialog ? (
				<div
					aria-modal="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(47,64,80,0.78)] px-4"
					data-testid="student-case-leave-quiz-dialog"
					role="dialog"
				>
					<div className="w-full max-w-md border border-border-gray bg-white p-5 text-primary-text shadow-soft sm:p-6">
						<h2 className="text-lg font-semibold">Leave CME Quiz?</h2>
						<p className="mt-3 text-sm leading-6 text-muted-gray">
							Your current answers will not be submitted. Leaving now does not
							count as a failed attempt.
						</p>
						<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
							<Button
								className="w-full sm:w-auto"
								data-testid="student-case-stay-on-quiz"
								onClick={() => setShowLeaveQuizDialog(false)}
								type="button"
								variant="secondary"
							>
								Stay
							</Button>
							<Button
								className="w-full sm:w-auto"
								data-testid="student-case-confirm-leave-quiz"
								onClick={leaveQuizForResources}
								type="button"
							>
								Leave
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}

function formatPdfSize(size: number) {
	if (size < 1_024) {
		return `${size} B`;
	}

	if (size < 1_024 * 1_024) {
		return `${Math.round(size / 1_024)} KB`;
	}

	return `${(size / 1_024 / 1_024).toFixed(1)} MB`;
}

function isDeadlineWithinReminderWindow(deadlineAt: number, isExpired: boolean) {
	if (isExpired) {
		return false;
	}

	const millisecondsUntilDeadline = deadlineAt - Date.now();

	return (
		millisecondsUntilDeadline > 0 &&
		millisecondsUntilDeadline <= deadlineReminderWindowMilliseconds
	);
}

function PdfFileIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-6 w-6"
			focusable="false"
			viewBox="0 0 24 24"
		>
			<path
				d="M6 2.75h8.25L19 7.5v13.75H6V2.75Zm7.5 1.5v4h4l-4-4Zm-6 0v15.5h10V9.75H12v-5.5H7.5Z"
				fill="currentColor"
			/>
			<path
				d="M8.5 14.25h7v1.5h-7v-1.5Zm0 3h5v1.5h-5v-1.5Z"
				fill="currentColor"
			/>
		</svg>
	);
}

function DownloadIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-5 w-5"
			focusable="false"
			viewBox="0 0 24 24"
		>
			<path
				d="M11.25 3.5h1.5v9.4l3.2-3.2 1.05 1.1-5 5-5-5 1.05-1.1 3.2 3.2V3.5Z"
				fill="currentColor"
			/>
			<path
				d="M5 18.75h14v1.5H5v-1.5Z"
				fill="currentColor"
			/>
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-7 w-7"
			focusable="false"
			viewBox="0 0 24 24"
		>
			<path
				d="m9.25 16.35-4.1-4.1 1.1-1.1 3 3 8.5-8.5 1.1 1.1-9.6 9.6Z"
				fill="currentColor"
			/>
		</svg>
	);
}
