import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { emptyCaseDraft } from "../schema";
import { ReviewSection } from "./review-section";

describe("ReviewSection", () => {
	it("renders expandable long-text panels and persisted PDF previews", () => {
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
				}}
				readyToPublish={false}
				updateDraft={() => {}}
				validation={{ cmeQuestions: "Add 3 to 5 CME questions." }}
			/>,
		);

		expect(markup).toContain('data-testid="teacher-case-review-presentation"');
		expect(markup).toContain("<details");
		expect(markup).toContain("<summary");
		expect(markup).toContain("Line one");
		expect(markup).not.toContain("word");
		expect(markup).toContain("Case Materials");
		expect(markup).toContain("case-material.pdf");
		expect(markup).toContain("data:application/pdf;base64,JVBERi0xLjQ=");
	});

	it("disables publish when another case is active", () => {
		const markup = renderToStaticMarkup(
			<ReviewSection
				activePublishedCase={{
					title: "Published endocrine case",
					deadlineAt: Date.UTC(2026, 7, 12),
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
		expect(markup).toContain("disabled");
	});
});
