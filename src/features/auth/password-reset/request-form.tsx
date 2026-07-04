"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRightIcon } from "@/components/ui/arrow-right-icon";
import { Button } from "@/components/ui/button";
import {
	AuthStatusMessage,
	fieldError,
	inputClasses,
	type StatusTone
} from "@/features/auth/form-helpers";
import {
	initialPasswordResetRequestFormState,
	type PasswordResetRequestFormState
} from "./state";

type PasswordResetRequestFormProps = {
	action: (
		previousState: PasswordResetRequestFormState,
		formData: FormData
	) => Promise<PasswordResetRequestFormState>;
	initialState?: PasswordResetRequestFormState;
};

function StatusMessage({ state }: { state: PasswordResetRequestFormState }) {
	if (!state.message) {
		return null;
	}

	const tone: StatusTone =
		state.status === "success"
			? "success"
			: state.status === "notice"
				? "warning"
				: "error";
	const testId =
		state.status === "success"
			? "forgot-password-success-message"
			: state.status === "notice"
				? "forgot-password-notice-message"
				: "forgot-password-error-message";

	return (
		<AuthStatusMessage
			role={state.status === "error" ? "alert" : "status"}
			testId={testId}
			tone={tone}
		>
			{state.message}
		</AuthStatusMessage>
	);
}

export function PasswordResetRequestForm({
	action,
	initialState
}: PasswordResetRequestFormProps) {
	const [state, formAction, isPending] = useActionState(
		action,
		initialState ?? initialPasswordResetRequestFormState
	);
	const emailError = fieldError(state, "email");

	return (
		<form
			action={formAction}
			className="mt-7"
			data-testid="forgot-password-form"
		>
			<div className="grid gap-2">
				<label
					className="text-xs font-medium text-muted-gray"
					htmlFor="forgot-password-email"
				>
					Email address
				</label>
				<input
					aria-describedby={
						emailError ? "forgot-password-email-error" : undefined
					}
					aria-invalid={Boolean(emailError)}
					autoComplete="email"
					className={inputClasses(Boolean(emailError))}
					data-testid="forgot-password-email"
					defaultValue={state.values.email}
					id="forgot-password-email"
					inputMode="email"
					name="email"
					placeholder="jordan@example.com"
					type="email"
				/>
				{emailError ? (
					<p
						className="text-xs font-medium leading-5 text-error-red"
						data-testid="forgot-password-email-error"
						id="forgot-password-email-error"
					>
						{emailError}
					</p>
				) : null}
			</div>

			<StatusMessage state={state} />

			<Button
				className="group mt-6 w-full justify-start px-5 text-left transition duration-200 hover:!bg-action-hover"
				data-testid="forgot-password-submit"
				disabled={isPending}
				type="submit"
			>
				<span>{isPending ? "Sending..." : "Send reset link"}</span>
				<span className="ml-auto transition-transform duration-200 group-hover:translate-x-1">
					<ArrowRightIcon />
				</span>
			</Button>

			<Link
				className="mt-5 inline-flex text-[11px] font-bold uppercase underline underline-offset-2"
				data-testid="forgot-password-login-link"
				href="/login"
			>
				Back to sign in
			</Link>
		</form>
	);
}
