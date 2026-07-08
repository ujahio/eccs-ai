import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	SectionNavigation,
	WizardContentFrame,
	WizardHeader,
	WizardStatusMessages,
} from "./wizard-frame";

describe("case authoring wizard frame", () => {
	it("renders title-case authoring sections with stable selectors", () => {
		const markup = renderToStaticMarkup(
			<SectionNavigation activeSection="title" onSelectSection={() => {}} />,
		);

		expect(markup).toContain('aria-label="Case authoring sections"');
		expect(markup).toContain("self-start");
		expect(markup).toContain('data-testid="teacher-case-section-title"');
		expect(markup).toContain("Title &amp; Description");
		expect(markup).toContain("Final Review");
	});

	it("renders Save Draft and header Publish Case actions", () => {
		const markup = renderToStaticMarkup(
			<WizardHeader
				isDirty
				onSaveDraft={() => {}}
				onPublish={() => {}}
				publishDisabled
			/>,
		);

		expect(markup).toContain('data-testid="teacher-case-save-draft"');
		expect(markup).toContain('data-testid="teacher-case-header-publish"');
		expect(markup).toContain("Unsaved changes");
		expect(markup).toContain("Publish Case");
		expect(markup).toContain("disabled");
	});

	it("renders draft status and non-blocking navigation warnings", () => {
		const markup = renderToStaticMarkup(
			<WizardStatusMessages
				draftValidationMessage="Enter a Case Title before saving this draft."
				draftStatus="saving"
				publishStatus="publishing"
				sectionWarning="You have unsaved changes. Select Save Draft to store them."
			/>,
		);

		expect(markup).toContain('data-testid="teacher-case-draft-validation"');
		expect(markup).toContain('data-testid="teacher-case-draft-saving"');
		expect(markup).toContain('data-testid="teacher-case-publishing"');
		expect(markup).toContain('data-testid="teacher-case-navigation-warning"');
		expect(markup).toContain("Enter a Case Title before saving this draft.");
		expect(markup).toContain(
			"You have unsaved changes. Select Save Draft to store them.",
		);
	});

	it("removes the next button from final review", () => {
		const markup = renderToStaticMarkup(
			<WizardContentFrame
				activeSection="review"
				onNextSection={() => {}}
				onPreviousSection={() => {}}
			>
				<div>Review content</div>
			</WizardContentFrame>,
		);

		expect(markup).toContain('data-testid="teacher-case-previous-section"');
		expect(markup).not.toContain('data-testid="teacher-case-next-section"');
	});
});
