import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyCaseDraft } from "../schema";
import { ReviewSection } from "./review-section";

describe("ReviewSection", () => {
	it("renders expandable long-text panels and persisted PDF links", () => {
		const markup = renderToStaticMarkup(
			<ReviewSection
				activePublishedCase={null}
				draft={{
					...emptyCaseDraft,
					title: "Acute endocrine review",
					description: "A focused review for learners.",
					presentation: "Line one\nLine two",
					modelAnswer: "Model answer text",
					lectureText: "Lecture text for learners",
					cmeQuestions: [
						{
							id: "question-1",
							prompt: "Which result supports the diagnosis?",
							options: [
								{ id: "option-a", text: "Elevated marker" },
								{ id: "option-b", text: "Normal marker" },
							],
							correctOptionId: "option-a",
						},
					],
					attachments: [
						{
							dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
							id: "attachment-1",
							name: "case-material.pdf",
							size: 2048,
							type: "application/pdf",
							lastModified: 1,
						},
					],
					deadlineDate: "2026-08-12",
				}}
				readyToPublish={false}
				updateDraft={() => {}}
				validation={{ cmeQuestions: "Add 3 to 5 CME questions." }}
			/>,
		);

		expect(
			markup.indexOf('data-testid="teacher-case-publish-readiness"'),
		).toBeLessThan(markup.indexOf('data-testid="teacher-case-deadline-date"'));
		expect(markup).toContain("space-y-4");
		expect(markup).not.toContain("lg:grid-cols-3");
		expect(markup).toContain('data-testid="teacher-case-review-presentation"');
		expect(markup).toContain("<details");
		expect(markup).toContain("<summary");
		expect(markup).toContain("Line one");
		expect(markup).not.toContain("word");
		expect(markup).toContain("1 question added");
		expect(markup).not.toContain("0 questions added");
		expect(markup).toContain('data-testid="teacher-case-review-cme-questions"');
		expect(markup).toContain("Which result supports the diagnosis?");
		expect(markup).toContain("Elevated marker");
		expect(markup).toContain("Correct answer");
		expect(markup).toContain("Case Materials");
		expect(markup).toContain("case-material.pdf");
		expect(markup).toContain("data:application/pdf;base64,JVBERi0xLjQ=");
		expect(markup).toContain("Expires at");
		expect(markup).toContain("Aug 12, 2026");
		expect(markup).toContain("11:59 PM UAE time");
		expect(markup).not.toContain('data-testid="teacher-case-publish"');
		expect(markup).not.toContain("<object");
	});

	it("disables publish when another case is active", () => {
		const markup = renderToStaticMarkup(
			<ReviewSection
				activePublishedCase={{
					title: "Published endocrine case",
					deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
				}}
				draft={emptyCaseDraft}
				readyToPublish
				updateDraft={() => {}}
				validation={{}}
			/>,
		);

		expect(markup).toContain(
			"Publishing is unavailable while another case is active.",
		);
		expect(markup).toContain('data-testid="teacher-case-active-publish-blocker"');
		expect(markup).not.toContain('data-testid="teacher-case-publish"');
	});
});
