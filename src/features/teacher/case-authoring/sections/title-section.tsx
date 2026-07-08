import type { CaseDraft, CaseDraftValidation } from "../schema";
import { Field, SectionHeading } from "../shared";

type UpdateDraft = (update: Partial<CaseDraft>) => void;

export function TitleSection({
	draft,
	updateDraft,
	validation = {},
}: {
	draft: CaseDraft;
	updateDraft: UpdateDraft;
	validation?: CaseDraftValidation;
}) {
	return (
		<div>
			<SectionHeading title="Title & Description" />
			<Field label="Case Title" testId="teacher-case-title">
				<input
					aria-describedby={
						validation.title ? "teacher-case-title-error" : undefined
					}
					aria-invalid={validation.title ? "true" : undefined}
					className={[
						"h-11 w-full rounded-[3px] border bg-white px-3 text-sm outline-none focus:border-brand-teal",
						validation.title ? "border-error-red" : "border-border-gray",
					].join(" ")}
					data-testid="teacher-case-title"
					id="teacher-case-title"
					onChange={(event) => updateDraft({ title: event.target.value })}
					value={draft.title}
				/>
				{validation.title ? (
					<p
						className="mt-2 text-xs font-semibold text-error-red"
						data-testid="teacher-case-title-error"
						id="teacher-case-title-error"
					>
						{validation.title}
					</p>
				) : null}
			</Field>
			<Field label="Description" testId="teacher-case-description">
				<textarea
					className="min-h-32 w-full resize-y rounded-[3px] border border-border-gray bg-white p-3 text-sm leading-6 outline-none focus:border-brand-teal"
					data-testid="teacher-case-description"
					id="teacher-case-description"
					onChange={(event) => updateDraft({ description: event.target.value })}
					value={draft.description}
				/>
			</Field>
		</div>
	);
}
