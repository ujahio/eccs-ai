import type { CaseDraft } from "../schema";
import { Field, SectionHeading } from "../shared";

export function ResourcesSection({
	addPdfAttachments,
	draft,
	removeAttachment,
	updateDeadlineDate,
	updateLectureText,
}: {
	addPdfAttachments: (files: FileList | null) => void;
	draft: CaseDraft;
	removeAttachment: (attachmentId: string) => void;
	updateDeadlineDate: (value: string) => void;
	updateLectureText: (value: string) => void;
}) {
	return (
		<div>
			<SectionHeading
				description="Add lecture text, case materials, and the student deadline date."
				title="Case Study"
			/>
			<Field label="Lecture Text" testId="teacher-case-lecture-text">
				<textarea
					className="min-h-64 w-full resize-y rounded-[3px] border border-border-gray bg-white p-3 text-sm leading-7 outline-none focus:border-brand-teal"
					data-testid="teacher-case-lecture-text"
					id="teacher-case-lecture-text"
					onChange={(event) => updateLectureText(event.target.value)}
					value={draft.lectureText}
				/>
			</Field>
			<Field label="Deadline Date" testId="teacher-case-resource-deadline-date">
				<input
					className="h-11 w-full rounded-[3px] border border-border-gray bg-white px-3 text-sm outline-none focus:border-brand-teal sm:max-w-xs"
					data-testid="teacher-case-resource-deadline-date"
					id="teacher-case-resource-deadline-date"
					onChange={(event) => updateDeadlineDate(event.target.value)}
					type="date"
					value={draft.deadlineDate}
				/>
			</Field>
			<div className="mt-5 rounded border border-border-gray bg-app-canvas p-4">
				<p className="text-sm font-semibold">Case Materials</p>
				<input
					accept="application/pdf,.pdf"
					className="sr-only"
					data-testid="teacher-case-pdf-attachments"
					id="teacher-case-pdf-attachments"
					multiple
					onChange={(event) => addPdfAttachments(event.target.files)}
					type="file"
				/>
				<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
					<label
						className="inline-flex h-10 cursor-pointer items-center justify-center rounded border border-border-gray bg-white px-4 text-xs font-bold uppercase text-primary-text transition hover:border-primary-action focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-teal"
						htmlFor="teacher-case-pdf-attachments"
					>
						Upload Files
					</label>
					<p
						className="text-sm text-muted-gray"
						data-testid="teacher-case-materials-state"
					>
						{draft.attachments.length > 0
							? `${draft.attachments.length} Case Material${draft.attachments.length === 1 ? "" : "s"} Selected`
							: "No Case Materials Selected"}
					</p>
				</div>
				{draft.attachments.length > 0 ? (
					<ul className="mt-4 space-y-2" data-testid="teacher-case-pdf-list">
						{draft.attachments.map((attachment) => (
							<li
								className="flex items-center justify-between gap-3 border-t border-border-gray pt-2 text-sm"
								key={attachment.id}
							>
								<span>{attachment.name}</span>
								<button
									className="text-xs font-bold uppercase text-error-red"
									onClick={() => removeAttachment(attachment.id)}
									type="button"
								>
									Remove
								</button>
							</li>
						))}
					</ul>
				) : null}
			</div>
		</div>
	);
}
