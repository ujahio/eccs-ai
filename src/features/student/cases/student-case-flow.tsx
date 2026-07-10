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

type CaseFlowStep = "presentation" | "analysis" | "comparison";

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
};

const expiredMessage =
	"This case is no longer active. Return to your dashboard for the current case status.";

export function StudentCaseFlow({ caseRecord }: StudentCaseFlowProps) {
	const [step, setStep] = useState<CaseFlowStep>("presentation");
	const [analysisText, setAnalysisText] = useState("");
	const [submittedAnalysis, setSubmittedAnalysis] = useState("");
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
							Submit
						</Button>
					</div>
				</form>
			) : null}

			{!isExpired && step === "comparison" ? (
				<article
					className="border border-border-gray bg-white p-5 sm:p-7"
					data-testid="student-case-comparison-step"
				>
					<div className="grid gap-4 lg:grid-cols-2">
						<section className="border border-border-gray bg-app-canvas p-4">
							<h2 className="text-base font-semibold">Your Analysis</h2>
							<div
								className="mt-4 whitespace-pre-wrap text-base leading-7 text-primary-text"
								data-testid="student-case-submitted-analysis"
							>
								{submittedAnalysis}
							</div>
						</section>
						<section className="border border-border-gray bg-app-canvas p-4">
							<h2 className="text-base font-semibold">Model Answer</h2>
							<div
								className="mt-4 whitespace-pre-wrap text-base leading-7 text-primary-text"
								data-testid="student-case-model-answer"
							>
								{caseRecord.modelAnswer}
							</div>
						</section>
					</div>
					<div className="mt-7 flex justify-end">
						<Button
							className="w-full sm:w-auto"
							data-testid="student-case-edit-analysis"
							onClick={editAnalysis}
							type="button"
							variant="secondary"
						>
							Edit My Analysis
						</Button>
					</div>
				</article>
			) : null}
		</section>
	);
}
