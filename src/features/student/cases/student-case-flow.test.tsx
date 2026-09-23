import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	isStudentCaseDeadlineStep,
	StudentCaseFlow,
	type CaseFlowStep,
} from "./student-case-flow";
import type { StudentCasePresentation } from "./student-case";

// Arbitrary fixed reference instant. Time is faked for these tests, so the
// absolute date is irrelevant — only the relative deltas below matter. Do not
// "refresh" this to today's date when the suite is run later.
const FIXED_NOW = Date.UTC(2026, 6, 20, 12);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

describe("StudentCaseFlow", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FIXED_NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("treats the certificate step as post-deadline-display", () => {
		const deadlineSteps: CaseFlowStep[] = [
			"presentation",
			"analysis",
			"comparison",
			"resources",
			"quiz",
		];

		for (const step of deadlineSteps) {
			expect(isStudentCaseDeadlineStep(step)).toBe(true);
		}
		expect(isStudentCaseDeadlineStep("feedback")).toBe(false);
		expect(isStudentCaseDeadlineStep("certificate")).toBe(false);
	});

	it("renders active case presentation content", () => {
		const markup = renderToStaticMarkup(
			<StudentCaseFlow
				caseRecord={caseRecordFixture()}
				feedbackAction={feedbackActionStub}
				quizAction={async () => ({
					message: "",
					status: "idle",
				})}
				quizReviewAction={async () => ({
					message: "",
					status: "ready",
				})}
			/>,
		);

		expect(markup).toContain("Case Presentation");
		expect(markup).not.toContain("Acute endocrine review");
		expect(markup).not.toContain("A focused clinical case.");
		expect(markup).not.toContain("Analysis Submitted");
		expect(markup).not.toContain("Teacher model answer for comparison.");
		expect(markup).not.toContain("Teacher lecture text for resources.");
		expect(markup).not.toContain("Which finding best supports");
		expect(markup).toContain("Patient presentation and clinical context.");
		expect(markup).toContain("Continue");
	});

	it("shows a due-soon deadline indicator inside the two-day reminder window", () => {
		// Now = FIXED_NOW + 9 days; deadline = FIXED_NOW + 11 days minus 1 hour
		// (47 hours out, inside the 48-hour reminder window).
		vi.setSystemTime(FIXED_NOW + 9 * DAY_MS);

		const markup = renderToStaticMarkup(
			<StudentCaseFlow
				caseRecord={caseRecordFixture({
					deadlineAt: FIXED_NOW + 11 * DAY_MS - HOUR_MS,
				})}
				feedbackAction={feedbackActionStub}
				quizAction={async () => ({
					message: "",
					status: "idle",
				})}
				quizReviewAction={async () => ({
					message: "",
					status: "ready",
				})}
			/>,
		);

		expect(markup).toContain('data-testid="student-case-deadline-date"');
		expect(markup).toContain('data-testid="student-case-deadline-reminder"');
		expect(markup).toContain("Due Soon");
		expect(markup).toContain("border-[#f4c7c7]");
		expect(markup).toContain("bg-[#fff7f7]");
		expect(markup).toContain("text-[#b94747]");
		expect(markup).not.toContain("remaining");
		expect(markup).not.toContain("left");
	});

	it("does not show the due-soon indicator outside the two-day reminder window", () => {
		// Same deadline as the due-soon test; now = FIXED_NOW (10 days 23 hours
		// out, outside the 48-hour reminder window).
		vi.setSystemTime(FIXED_NOW);

		const markup = renderToStaticMarkup(
			<StudentCaseFlow
				caseRecord={caseRecordFixture({
					deadlineAt: FIXED_NOW + 11 * DAY_MS - HOUR_MS,
				})}
				feedbackAction={feedbackActionStub}
				quizAction={async () => ({
					message: "",
					status: "idle",
				})}
				quizReviewAction={async () => ({
					message: "",
					status: "ready",
				})}
			/>,
		);

		expect(markup).toContain('data-testid="student-case-deadline-date"');
		expect(markup).not.toContain('data-testid="student-case-deadline-reminder"');
		expect(markup).not.toContain("Due Soon");
		expect(markup).not.toContain("border-[#f4c7c7]");
		expect(markup).not.toContain("bg-[#fff7f7]");
	});
});

function caseRecordFixture(
	overrides: Partial<StudentCasePresentation> = {},
): StudentCasePresentation {
	return {
		attachments: [],
		caseId: "case-1",
		cmeQuestions: [
			{
				questionId: "question-1",
				prompt: "Which finding best supports the diagnosis?",
				options: [
					{ optionId: "q1-a", text: "Expected finding" },
					{ optionId: "q1-b", text: "Distractor finding" },
				],
			},
			{
				questionId: "question-2",
				prompt: "Which next step is most appropriate?",
				options: [
					{ optionId: "q2-a", text: "Expected next step" },
					{ optionId: "q2-b", text: "Distractor next step" },
				],
			},
			{
				questionId: "question-3",
				prompt: "Which teaching point should be prioritized?",
				options: [
					{ optionId: "q3-a", text: "Expected teaching point" },
					{ optionId: "q3-b", text: "Distractor teaching point" },
				],
			},
		],
		deadlineAt: FIXED_NOW + 10 * DAY_MS,
		lectureText: "Teacher lecture text for resources.",
		modelAnswer: "Teacher model answer for comparison.",
		presentation: "Patient presentation and clinical context.",
		title: "Acute endocrine review",
		...overrides,
	};
}

async function feedbackActionStub() {
	return {
		message: "",
		status: "submitted" as const,
	};
}
