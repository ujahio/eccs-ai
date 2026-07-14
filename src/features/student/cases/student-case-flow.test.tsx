import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	isStudentCaseDeadlineStep,
	StudentCaseFlow,
	type CaseFlowStep,
} from "./student-case-flow";
import type { StudentCasePresentation } from "./student-case";

describe("StudentCaseFlow", () => {
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
		const dateNowSpy = vi
			.spyOn(Date, "now")
			.mockReturnValue(Date.UTC(2026, 6, 29, 12));

		let markup = "";
		try {
			markup = renderToStaticMarkup(
				<StudentCaseFlow
					caseRecord={caseRecordFixture({
						deadlineAt: Date.UTC(2026, 6, 31, 11),
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
		} finally {
			dateNowSpy.mockRestore();
		}

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
		const dateNowSpy = vi
			.spyOn(Date, "now")
			.mockReturnValue(Date.UTC(2026, 6, 20, 12));

		let markup = "";
		try {
			markup = renderToStaticMarkup(
				<StudentCaseFlow
					caseRecord={caseRecordFixture({
						deadlineAt: Date.UTC(2026, 6, 31, 11),
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
		} finally {
			dateNowSpy.mockRestore();
		}

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
		deadlineAt: Date.UTC(2026, 6, 31),
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
