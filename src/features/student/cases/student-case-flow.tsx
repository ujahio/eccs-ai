"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDubaiDate } from "@/lib/date-format";
import {
	countAnalysisWords,
	maximumAnalysisWordCount,
	minimumAnalysisWordCount,
	validateAnalysisWordCount,
} from "./analysis";
import type { StudentCasePresentation } from "./student-case";

type StudentCaseFlowProps = {
	caseRecord: StudentCasePresentation;
};

type CaseFlowStep = "presentation" | "analysis" | "comparison" | "resources";
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
};

const expiredMessage =
	"This case is no longer active. Return to your dashboard for the current case status.";

export function StudentCaseFlow({ caseRecord }: StudentCaseFlowProps) {
	const [step, setStep] = useState<CaseFlowStep>("presentation");
	const [analysisText, setAnalysisText] = useState("");
	const [submittedAnalysis, setSubmittedAnalysis] = useState("");
	const [analysisReviewMode, setAnalysisReviewMode] =
		useState<AnalysisReviewMode>("both");
	const [message, setMessage] = useState("");
	const [isExpired, setIsExpired] = useState(
		() => Date.now() > caseRecord.deadlineAt,
	);
	const wordCount = useMemo(
		() => countAnalysisWords(analysisText),
		[analysisText],
	);
	const validation = validateAnalysisWordCount(analysisText);
	const isAnalysisValid = validation.valid;
	const currentStepCopy = stepCopy[step];
	const visibleMessage = isExpired ? expiredMessage : message;
	const showPersonalAnalysis = analysisReviewMode !== "modelAnswer";
	const showModelAnswer = analysisReviewMode !== "personalAnalysis";

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
						Deadline: {formatDubaiDate(caseRecord.deadlineAt)} UAE
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

					<div className="mt-7 flex justify-start">
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-back-to-comparison"
							onClick={returnToComparison}
							type="button"
							variant="secondary"
						>
							Previous
						</Button>
					</div>
				</article>
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
