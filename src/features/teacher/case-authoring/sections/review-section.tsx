import { Button } from "@/components/ui/button";
import type { CaseDraft, CaseDraftValidation } from "../schema";
import { Field, ReviewBlock, SectionHeading } from "../shared";

type UpdateDraft = (update: Partial<CaseDraft>) => void;

export function ReviewSection({
	draft,
	readyToPublish,
	updateDraft,
	validation,
}: {
	draft: CaseDraft;
	readyToPublish: boolean;
	updateDraft: UpdateDraft;
	validation: CaseDraftValidation;
}) {
	const validationEntries = Object.entries(validation);

	return (
		<div data-testid="teacher-case-review-section">
			<SectionHeading
				description="Review all content, add the calendar deadline, and confirm publish readiness."
				title="Final Review"
			/>
			<Field label="Deadline Date" testId="teacher-case-deadline-date">
				<input
					className={[
						"h-11 w-full rounded-[3px] border bg-white px-3 text-sm outline-none focus:border-brand-teal sm:max-w-xs",
						validation.deadlineDate ? "border-error-red" : "border-border-gray",
					].join(" ")}
					data-testid="teacher-case-deadline-date"
					id="teacher-case-deadline-date"
					onChange={(event) =>
						updateDraft({ deadlineDate: event.target.value })
					}
					type="date"
					value={draft.deadlineDate}
				/>
				{validation.deadlineDate ? (
					<p className="mt-2 text-xs font-semibold text-error-red">
						{validation.deadlineDate}
					</p>
				) : null}
			</Field>
			<div className="mt-5 grid gap-4 lg:grid-cols-2">
				<ReviewBlock label="Case Title" value={draft.title} />
				<ReviewBlock label="Description" value={draft.description} />
				<ReviewBlock label="Case Presentation" value={draft.presentation} />
				<ReviewBlock label="Model Answer" value={draft.modelAnswer} />
				<ReviewBlock label="Lecture Text" value={draft.lectureText} />
				<ReviewBlock
					label="PDF Attachments"
					value={
						draft.attachments.length > 0
							? draft.attachments.map((attachment) => attachment.name).join(", ")
							: "No PDFs attached"
					}
				/>
				<ReviewBlock
					label="CME Questions"
					value={`${draft.cmeQuestions.length} question${draft.cmeQuestions.length === 1 ? "" : "s"} added`}
				/>
			</div>
			<div
				className={[
					"mt-5 border p-4",
					readyToPublish
						? "border-success-mint bg-success-soft"
						: "border-border-gray bg-app-canvas",
				].join(" ")}
				data-testid="teacher-case-publish-readiness"
			>
				<p className="text-sm font-semibold">
					{readyToPublish
						? "Ready to publish"
						: "Draft can be saved, but publish needs more content."}
				</p>
				{validationEntries.length > 0 ? (
					<ul className="mt-3 space-y-1 text-sm text-muted-gray">
						{validationEntries.map(([key, value]) => (
							<li key={key}>{value}</li>
						))}
					</ul>
				) : null}
			</div>
			<Button
				className="mt-5"
				data-testid="teacher-case-publish"
				disabled={!readyToPublish}
			>
				Publish Case
			</Button>
		</div>
	);
}
