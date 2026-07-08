import { Field, SectionHeading } from "../shared";

export function LongTextSection({
	description,
	label,
	onChange,
	testId,
	value,
}: {
	description: string;
	label: string;
	onChange: (value: string) => void;
	testId: string;
	value: string;
}) {
	return (
		<div>
			<SectionHeading description={description} title={label} />
			<Field hideLabel label={label} testId={testId}>
				<textarea
					className="min-h-[360px] w-full resize-y rounded-[3px] border border-border-gray bg-white p-3 text-sm leading-7 outline-none focus:border-brand-teal"
					data-testid={testId}
					id={testId}
					onChange={(event) => onChange(event.target.value)}
					value={value}
				/>
			</Field>
		</div>
	);
}
