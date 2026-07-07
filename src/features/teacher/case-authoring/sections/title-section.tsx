import type { CaseDraft } from "../schema";
import { Field, SectionHeading } from "../shared";

type UpdateDraft = (update: Partial<CaseDraft>) => void;

export function TitleSection({
	draft,
	updateDraft,
}: {
	draft: CaseDraft;
	updateDraft: UpdateDraft;
}) {
	return (
		<div>
			<SectionHeading
				title="Title & Description"
			/>
			<Field label="Case Title" testId="teacher-case-title">
				<input
					className="h-11 w-full rounded-[3px] border border-border-gray bg-white px-3 text-sm outline-none focus:border-brand-teal"
					data-testid="teacher-case-title"
					id="teacher-case-title"
					onChange={(event) => updateDraft({ title: event.target.value })}
					value={draft.title}
				/>
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
