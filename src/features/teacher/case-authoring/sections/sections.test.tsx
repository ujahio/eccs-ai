import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyCaseDraft, createEmptyCmeQuestion } from "../schema";
import { CmeSection } from "./cme-section";
import { LongTextSection } from "./long-text-section";
import { ResourcesSection } from "./resources-section";
import { TitleSection } from "./title-section";

describe("case authoring sections", () => {
	it("renders title and long-text section labels", () => {
		const titleMarkup = renderToStaticMarkup(
			<TitleSection
				draft={emptyCaseDraft}
				updateDraft={() => {}}
				validation={{
					title: "Enter a Case Title before saving this draft.",
				}}
			/>,
		);
		const longTextMarkup = renderToStaticMarkup(
			<LongTextSection
				description="Describe the clinical scenario."
				label="Case Presentation"
				testId="teacher-case-presentation"
				value="Clinical text"
				onChange={() => {}}
			/>,
		);

		expect(titleMarkup).toContain("Case Title");
		expect(titleMarkup).toContain("Enter a Case Title before saving this draft.");
		expect(titleMarkup).toContain('data-testid="teacher-case-description"');
		expect(longTextMarkup).toContain("Case Presentation");
		expect(longTextMarkup).toContain('data-testid="teacher-case-presentation"');
	});

	it("renders Case Study resources with deadline and material state", () => {
		const markup = renderToStaticMarkup(
			<ResourcesSection
				addPdfAttachments={async () => {}}
				draft={{
					...emptyCaseDraft,
					attachments: [
						{
							id: "attachment-1",
							name: "resource.pdf",
							size: 100,
							type: "application/pdf",
							lastModified: 1,
						},
					],
				}}
				removeAttachment={() => {}}
				updateDeadlineDate={() => {}}
				updateLectureText={() => {}}
			/>,
		);

		expect(markup).toContain("Case Study");
		expect(markup).toContain("Deadline Date");
		expect(markup).toContain("1 Case Material Selected");
		expect(markup).toContain("resource.pdf");
	});

	it("renders CME question bubbles and started count", () => {
		const question = {
			...createEmptyCmeQuestion(),
			prompt: "Which finding should be prioritized?",
		};
		const markup = renderToStaticMarkup(
			<CmeSection
				activeQuestionIndex={0}
				addQuestion={() => {}}
				questions={[question, createEmptyCmeQuestion()]}
				removeQuestion={() => {}}
				setActiveQuestionIndex={() => {}}
				updateQuestion={() => {}}
			/>,
		);

		expect(markup).toContain("1 question started, 5 max");
		expect(markup).toContain('aria-label="Question 2"');
		expect(markup).toContain("Add Question");
	});
});
