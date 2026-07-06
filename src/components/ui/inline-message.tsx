import type { ReactNode } from "react";

export type InlineMessageTone = "success" | "warning" | "error" | "info";

const inlineMessageToneClasses: Record<InlineMessageTone, string> = {
	success: "border-success-mint bg-success-soft text-primary-text",
	info: "border-brand-teal bg-white text-primary-text",
	warning: "border-warning-gold bg-app-canvas text-primary-text",
	error: "border-error-red bg-white text-error-red",
};

export function InlineMessage({
	children,
	className,
	role,
	testId,
	tone,
}: {
	children: ReactNode;
	className?: string;
	role: "alert" | "status";
	testId: string;
	tone: InlineMessageTone;
}) {
	return (
		<p
			aria-live="polite"
			className={`border px-4 py-3 text-sm leading-6 ${inlineMessageToneClasses[tone]} ${className ?? ""}`}
			data-testid={testId}
			role={role}
		>
			{children}
		</p>
	);
}

export function FieldError({
	children,
	id,
	testId,
}: {
	children: ReactNode;
	id: string;
	testId: string;
}) {
	return (
		<p
			className="text-xs font-medium leading-5 text-error-red"
			data-testid={testId}
			id={id}
		>
			{children}
		</p>
	);
}
