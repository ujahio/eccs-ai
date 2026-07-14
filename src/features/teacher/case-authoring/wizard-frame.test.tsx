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

	it("renders Save Draft without a readiness label or publish action before review", () => {
		const markup = renderToStaticMarkup(
			<WizardHeader
				activeSection="title"
				isDirty
				onPublish={() => {}}
				onSaveDraft={() => {}}
				publishDisabled
			/>,
		);

		expect(markup).toContain('data-testid="teacher-case-save-draft"');
		expect(markup).toContain("Unsaved changes");
		expect(markup).not.toContain('data-testid="teacher-case-ready-message"');
		expect(markup).not.toContain("Ready to publish");
		expect(markup).not.toContain('data-testid="teacher-case-header-publish"');
		expect(markup).not.toContain("Publish Case");
	});

	it("renders the header Publish Case action on final review", () => {
		const markup = renderToStaticMarkup(
			<WizardHeader
				activeSection="review"
				isDirty={false}
				onPublish={() => {}}
				onSaveDraft={() => {}}
				publishDisabled={false}
			/>,
		);

		expect(markup).toContain('data-testid="teacher-case-header-publish"');
		expect(markup).toContain("Publish Case");
		expect(markup).not.toContain(
			'data-testid="teacher-case-header-publish" disabled=""',
		);
	});

	it("renders draft and publish status messages without duplicate dirty warnings", () => {
		const markup = renderToStaticMarkup(
			<WizardStatusMessages
				draftValidationMessage="Enter a Case Title before saving this draft."
				draftStatus="saving"
				publishStatus="publishing"
			/>,
		);

		expect(markup).toContain('data-testid="teacher-case-draft-validation"');
		expect(markup).toContain('data-testid="teacher-case-draft-saving"');
		expect(markup).toContain('data-testid="teacher-case-publishing"');
		expect(markup).toContain("Enter a Case Title before saving this draft.");
		expect(markup).not.toContain('data-testid="teacher-case-navigation-warning"');
		expect(markup).not.toContain("You have unsaved changes.");
	});

	it("removes footer navigation from final review", () => {
		const markup = renderToStaticMarkup(
			<WizardContentFrame
				activeSection="review"
				onNextSection={() => {}}
				onPreviousSection={() => {}}
			>
				<div>Review content</div>
			</WizardContentFrame>,
		);

		expect(markup).not.toContain('data-testid="teacher-case-previous-section"');
		expect(markup).not.toContain('data-testid="teacher-case-next-section"');
	});
});
