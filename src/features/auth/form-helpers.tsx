"use client";

import type { ReactNode } from "react";
import {
	FieldError as SharedFieldError,
	InlineMessage,
	type InlineMessageTone,
} from "@/components/ui/inline-message";

export type FormStateWithErrors<Field extends string> = {
	errors: Partial<Record<Field, string[]>>;
};

export type StatusTone = Extract<
	InlineMessageTone,
	"success" | "warning" | "error"
>;

export const authInputClasses =
	"h-11 w-full border bg-white px-3 text-sm leading-normal text-primary-text outline-none transition placeholder:text-disabled-gray focus:border-brand-teal";

export const authPasswordInputClasses =
	"min-w-0 flex-1 bg-transparent px-3 text-sm text-primary-text outline-none placeholder:text-disabled-gray";

const passwordShellBaseClasses =
	"flex h-11 items-center border bg-white transition focus-within:border-brand-teal";

export function fieldError<Field extends string>(
	state: FormStateWithErrors<Field>,
	field: Field
): string | undefined {
	return state.errors[field]?.[0];
}

export function inputClasses(hasError: boolean) {
	return `${authInputClasses} ${
		hasError ? "border-error-red focus:border-error-red" : "border-border-gray"
	}`;
}

export function passwordShellClasses(hasError: boolean) {
	return `${passwordShellBaseClasses} ${
		hasError
			? "border-error-red focus-within:border-error-red"
			: "border-border-gray"
	}`;
}

export function PasswordVisibilityToggle({
	isVisible,
	onToggle,
	testId
}: {
	isVisible: boolean;
	onToggle: () => void;
	testId: string;
}) {
	return (
		<button
			aria-label={isVisible ? "Hide password" : "Show password"}
			className="h-full px-3 text-[10px] font-bold uppercase text-primary-action transition hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
			data-testid={testId}
			onClick={onToggle}
			type="button"
		>
			{isVisible ? "Hide" : "Show"}
		</button>
	);
}

export function AuthStatusMessage({
	children,
	role,
	testId,
	tone
}: {
	children: ReactNode;
	role: "alert" | "status";
	testId: string;
	tone: StatusTone;
}) {
	return (
		<InlineMessage className="mt-6" role={role} testId={testId} tone={tone}>
			{children}
		</InlineMessage>
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
		<SharedFieldError id={id} testId={testId}>
			{children}
		</SharedFieldError>
	);
}
