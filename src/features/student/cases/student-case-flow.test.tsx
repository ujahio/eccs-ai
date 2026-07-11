import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentCaseFlow } from "./student-case-flow";

describe("StudentCaseFlow", () => {
	it("renders active case presentation content", () => {
		const markup = renderToStaticMarkup(
			<StudentCaseFlow
				caseRecord={{
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
				}}
				quizAction={async () => ({
					message: "",
					status: "idle",
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
});
