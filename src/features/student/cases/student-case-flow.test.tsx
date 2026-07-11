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
					deadlineAt: Date.UTC(2026, 6, 31),
					lectureText: "Teacher lecture text for resources.",
					modelAnswer: "Teacher model answer for comparison.",
					presentation: "Patient presentation and clinical context.",
				}}
			/>,
		);

		expect(markup).toContain("Case Presentation");
		expect(markup).not.toContain("Acute endocrine review");
		expect(markup).not.toContain("A focused clinical case.");
		expect(markup).not.toContain("Analysis Submitted");
		expect(markup).not.toContain("Teacher model answer for comparison.");
		expect(markup).not.toContain("Teacher lecture text for resources.");
		expect(markup).toContain("Patient presentation and clinical context.");
		expect(markup).toContain("Continue");
	});
});
