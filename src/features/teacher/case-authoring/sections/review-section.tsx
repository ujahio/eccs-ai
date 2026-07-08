import { PublishCaseButton } from "../wizard-frame";
import {
	hasCmeQuestionContent,
	type ActivePublishedCaseSummary,
	type CaseDraft,
	type CaseDraftValidation,
	type DraftAttachment,
} from "../schema";
import { Field, ReviewBlock, SectionHeading } from "../shared";

type UpdateDraft = (update: Partial<CaseDraft>) => void;

export function ReviewSection({
	activePublishedCase,
	draft,
	readyToPublish,
	updateDraft,
	validation,
}: {
	activePublishedCase: ActivePublishedCaseSummary | null;
	draft: CaseDraft;
	readyToPublish: boolean;
	updateDraft: UpdateDraft;
	validation: CaseDraftValidation;
}) {
	const validationEntries = Object.entries(validation);
	const hasActivePublishedCase = activePublishedCase !== null;
	const publishDisabled = !readyToPublish || hasActivePublishedCase;
	const authoredQuestionCount = draft.cmeQuestions.filter(
		hasCmeQuestionContent,
	).length;

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
			<div className="mt-5 grid gap-4 lg:grid-cols-3">
				<ReviewBlock label="Case Title" value={draft.title} />
				<ReviewBlock label="Description" value={draft.description} />
				<ReviewBlock
					label="CME Questions"
					value={`${authoredQuestionCount} question${authoredQuestionCount === 1 ? "" : "s"} added`}
				/>
			</div>
			<div className="mt-5 space-y-5">
				<ReviewTextPanel
					label="Case Presentation"
					testId="teacher-case-review-presentation"
					value={draft.presentation}
				/>
				<ReviewTextPanel
					label="Model Answer"
					testId="teacher-case-review-model-answer"
					value={draft.modelAnswer}
				/>
				<ReviewTextPanel
					label="Lecture Text"
					testId="teacher-case-review-lecture-text"
					value={draft.lectureText}
				/>
				<ReviewAttachmentPreviews attachments={draft.attachments} />
			</div>
			<div
				className={[
					"mt-5 border p-4",
					hasActivePublishedCase
						? "border-warning-gold bg-white"
						: readyToPublish
						? "border-success-mint bg-success-soft"
						: "border-border-gray bg-app-canvas",
				].join(" ")}
				data-testid="teacher-case-publish-readiness"
			>
				<p className="text-sm font-semibold">
					{hasActivePublishedCase
						? "Publishing is unavailable while another case is active."
						: readyToPublish
						? "Ready to publish"
						: "Draft can be saved, but publish needs more content."}
				</p>
				{hasActivePublishedCase ? (
					<p
						className="mt-2 text-sm leading-6 text-muted-gray"
						data-testid="teacher-case-active-publish-blocker"
					>
						{activePublishedCase.title} is active until{" "}
						{formatDubaiDate(activePublishedCase.deadlineAt)}. Publish this
						case after the active case closes.
					</p>
				) : null}
				{validationEntries.length > 0 ? (
					<ul className="mt-3 space-y-1 text-sm text-muted-gray">
						{validationEntries.map(([key, value]) => (
							<li key={key}>{value}</li>
						))}
					</ul>
				) : null}
			</div>
			<PublishCaseButton
				className="mt-5"
				data-testid="teacher-case-publish"
				disabled={publishDisabled}
			/>
		</div>
	);
}

function ReviewTextPanel({
	label,
	testId,
	value,
}: {
	label: string;
	testId: string;
	value: string;
}) {
	const trimmedValue = value.trim();

	return (
		<details className="border border-border-gray bg-white" data-testid={testId}>
			<summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary-text marker:text-muted-gray">
				{label}
			</summary>
			<div className="max-h-[32rem] overflow-auto border-t border-border-gray bg-app-canvas p-4 text-sm leading-7 text-primary-text sm:p-5">
				{trimmedValue ? (
					<p className="whitespace-pre-wrap">{trimmedValue}</p>
				) : (
					<p className="text-muted-gray">Not added yet</p>
				)}
			</div>
		</details>
	);
}

function ReviewAttachmentPreviews({
	attachments,
}: {
	attachments: DraftAttachment[];
}) {
	return (
		<details
			className="border border-border-gray bg-white"
			data-testid="teacher-case-review-pdf-previews"
		>
			<summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary-text marker:text-muted-gray">
				Case Materials
			</summary>
			{attachments.length > 0 ? (
				<div className="space-y-4 border-t border-border-gray p-4 sm:p-5">
					{attachments.map((attachment) => (
						<ReviewAttachmentPreview
							attachment={attachment}
							key={attachment.id}
						/>
					))}
				</div>
			) : (
				<p className="border-t border-border-gray p-4 text-sm text-muted-gray sm:p-5">
					No Case Materials attached
				</p>
			)}
		</details>
	);
}

function ReviewAttachmentPreview({
	attachment,
}: {
	attachment: DraftAttachment;
}) {
	const previewSource = attachment.previewUrl ?? attachment.dataUrl ?? "";

	return (
		<article className="border border-border-gray bg-app-canvas px-4 py-3">
			<div className="flex flex-col gap-2">
				{previewSource ? (
					<a
						className="text-sm font-semibold text-brand-teal underline-offset-4 hover:underline"
						href={previewSource}
						rel="noreferrer"
						target="_blank"
					>
						{attachment.name}
					</a>
				) : (
					<h4 className="text-sm font-semibold text-primary-text">
						{attachment.name}
					</h4>
				)}
				<p className="text-xs font-semibold uppercase text-muted-gray">
					{formatFileSize(attachment.size)}
				</p>
				{previewSource ? null : (
					<p className="text-sm leading-6 text-muted-gray">
						This material is saved, but no browser link is available. Re-upload
						it if you need to inspect the file contents here.
					</p>
				)}
			</div>
		</article>
	);
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	const kilobytes = bytes / 1024;
	if (kilobytes < 1024) {
		return `${kilobytes.toFixed(1)} KB`;
	}

	return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function formatDubaiDate(epochMilliseconds: number) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "Asia/Dubai",
		year: "numeric",
	}).format(new Date(epochMilliseconds));
}
