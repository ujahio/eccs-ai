import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { sectionLabels } from "./constants";
import { caseAuthoringSections, type CaseAuthoringSection } from "./schema";
import { StatusMessage } from "./shared";

export type DraftStatus = "idle" | "saving" | "saved" | "error";

export function WizardHeader({
	isDirty,
	onSaveDraft,
	publishDisabled,
}: {
	isDirty: boolean;
	onSaveDraft: () => void | Promise<void>;
	publishDisabled: boolean;
}) {
	return (
		<div className="mb-6 flex flex-col gap-4 border-b border-border-gray pb-5 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 className="mt-2 text-xl font-semibold sm:text-2xl">Case Studies</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-gray">
					Move through sections in any order.
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				{isDirty ? (
					<p
						className="text-sm font-semibold text-warning-gold"
						data-testid="teacher-case-dirty-message"
					>
						Unsaved changes
					</p>
				) : null}
				<Button
					data-testid="teacher-case-save-draft"
					onClick={onSaveDraft}
					title="Save Draft"
				>
					Save Draft
				</Button>
				<PublishCaseButton
					data-testid="teacher-case-header-publish"
					disabled={publishDisabled}
				/>
			</div>
		</div>
	);
}

export function PublishCaseButton({
	children = "Publish Case",
	...props
}: ComponentPropsWithoutRef<typeof Button>) {
	return <Button {...props}>{children}</Button>;
}

export function WizardStatusMessages({
	draftValidationMessage = "",
	draftStatus,
	sectionWarning,
}: {
	draftValidationMessage?: string;
	draftStatus: DraftStatus;
	sectionWarning: string;
}) {
	return (
		<>
			{draftValidationMessage ? (
				<StatusMessage
					testId="teacher-case-draft-validation"
					tone="error"
					value={draftValidationMessage}
				/>
			) : null}
			{draftStatus === "saved" ? (
				<StatusMessage
					testId="teacher-case-draft-saved"
					tone="success"
					value="Draft saved."
				/>
			) : null}
			{draftStatus === "saving" ? (
				<StatusMessage
					testId="teacher-case-draft-saving"
					tone="warning"
					value="Saving draft..."
				/>
			) : null}
			{draftStatus === "error" ? (
				<StatusMessage
					testId="teacher-case-draft-error"
					tone="error"
					value="The draft could not be saved. Try again."
				/>
			) : null}
			{sectionWarning ? (
				<StatusMessage
					testId="teacher-case-navigation-warning"
					tone="warning"
					value={sectionWarning}
				/>
			) : null}
		</>
	);
}

export function SectionNavigation({
	activeSection,
	onSelectSection,
}: {
	activeSection: CaseAuthoringSection;
	onSelectSection: (section: CaseAuthoringSection) => void;
}) {
	return (
		<nav
			aria-label="Case authoring sections"
			className="self-start rounded border border-border-gray bg-white p-3"
		>
			{caseAuthoringSections.map((section, index) => (
				<button
					className={[
						"flex min-h-12 w-full items-center gap-3 border-b border-border-gray px-3 text-left text-sm font-semibold transition last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal",
						activeSection === section
							? "text-brand-teal"
							: "text-primary-text hover:text-brand-teal",
					].join(" ")}
					data-testid={`teacher-case-section-${section}`}
					key={section}
					onClick={() => onSelectSection(section)}
					type="button"
				>
					<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-gray bg-app-canvas text-xs">
						{index + 1}
					</span>
					{sectionLabels[section]}
				</button>
			))}
		</nav>
	);
}

export function WizardContentFrame({
	activeSection,
	children,
	onNextSection,
	onPreviousSection,
}: {
	activeSection: CaseAuthoringSection;
	children: ReactNode;
	onNextSection: () => void;
	onPreviousSection: () => void;
}) {
	return (
		<div className="rounded border border-border-gray bg-white p-5 sm:p-6">
			{children}
			<div className="mt-6 flex flex-col-reverse gap-3 border-t border-border-gray pt-5 sm:flex-row sm:items-center sm:justify-between">
				<Button
					data-testid="teacher-case-previous-section"
					disabled={activeSection === "title"}
					onClick={onPreviousSection}
					variant="secondary"
				>
					Previous
				</Button>
				<div className="flex flex-col gap-3 sm:flex-row">
					{activeSection === "review" ? null : (
						<Button
							data-testid="teacher-case-next-section"
							onClick={onNextSection}
						>
							Next
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
