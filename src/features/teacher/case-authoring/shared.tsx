import type { ReactNode } from "react";

export function Field({
	children,
	hideLabel = false,
	label,
	testId,
}: {
	children: ReactNode;
	hideLabel?: boolean;
	label: string;
	testId: string;
}) {
	return (
		<div className="mt-5">
			<label
				className={hideLabel ? "sr-only" : "text-sm font-semibold"}
				htmlFor={testId}
			>
				{label}
			</label>
			<div className={hideLabel ? undefined : "mt-2"}>{children}</div>
		</div>
	);
}

export function SectionHeading({
	description,
	title,
}: {
	description?: string;
	title: string;
}) {
	return (
		<header>
			<h2 className="text-lg font-semibold">{title}</h2>
			{description ? (
				<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-gray">
					{description}
				</p>
			) : null}
		</header>
	);
}

export function ReviewBlock({ label, value }: { label: string; value: string }) {
	return (
		<div className="border border-border-gray bg-white p-4">
			<p className="text-xs font-semibold uppercase text-muted-gray">{label}</p>
			<p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-sm leading-6">
				{value.trim() || "Not added yet"}
			</p>
		</div>
	);
}

export function StatusMessage({
	testId,
	tone,
	value,
}: {
	testId: string;
	tone: "success" | "error" | "warning";
	value: string;
}) {
	const classes = {
		success: "border-success-mint bg-success-soft text-primary-text",
		error: "border-error-red bg-white text-error-red",
		warning: "border-warning-gold bg-white text-primary-text",
	};

	return (
		<p
			className={`mb-4 border px-4 py-3 text-sm font-semibold ${classes[tone]}`}
			data-testid={testId}
		>
			{value}
		</p>
	);
}
