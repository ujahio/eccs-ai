"use client";

import { useActionState, useState } from "react";
import { ArrowRightIcon } from "@/components/ui/arrow-right-icon";
import { Button } from "@/components/ui/button";
import { InlineMessage } from "@/components/ui/inline-message";
import { useNotifications } from "@/components/ui/notifications";
import {
	FieldError,
	PasswordVisibilityToggle,
	authPasswordInputClasses,
	fieldError,
	inputClasses,
	passwordShellClasses
} from "@/features/auth/form-helpers";
import {
	initialPasswordResetConfirmFormState,
	type PasswordResetConfirmFormState
} from "./state";
import { PasswordResetStatusMessage } from "./status-message";

type PasswordResetConfirmFormProps = {
	action: (
		previousState: PasswordResetConfirmFormState,
		formData: FormData
	) => Promise<PasswordResetConfirmFormState>;
	code: string;
};

export function PasswordResetConfirmForm({
	action,
	code
}: PasswordResetConfirmFormProps) {
	const [state, formAction, isPending] = useActionState(
		action,
		initialPasswordResetConfirmFormState(code)
	);
	const { dismissByKey } = useNotifications();
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const emailError = fieldError(state, "email");
	const codeError = fieldError(state, "code");
	const passwordError = fieldError(state, "password");
	const confirmPasswordError = fieldError(state, "confirmPassword");

	function submitAndClearStatus(formData: FormData) {
		dismissByKey("reset-password-status");
		formAction(formData);
	}

	return (
		<form
			action={submitAndClearStatus}
			className="mt-7"
			data-testid="reset-password-form"
		>
			<input
				data-testid="reset-password-code"
				name="code"
				type="hidden"
				value={state.values.code || code}
			/>
			<div className="grid gap-5">
				<div className="grid gap-2">
					<label
						className="text-xs font-medium text-muted-gray"
						htmlFor="reset-password-email"
					>
						Email address
					</label>
					<input
						aria-describedby={
							emailError ? "reset-password-email-error" : undefined
						}
						aria-invalid={Boolean(emailError)}
						autoComplete="email"
						className={inputClasses(Boolean(emailError))}
						data-testid="reset-password-email"
						defaultValue={state.values.email}
						id="reset-password-email"
						inputMode="email"
						name="email"
						placeholder="jordan@example.com"
						type="email"
					/>
					{emailError ? (
						<FieldError
							id="reset-password-email-error"
							testId="reset-password-email-error"
						>
							{emailError}
						</FieldError>
					) : null}
				</div>

				{codeError ? (
					<InlineMessage
						role="alert"
						testId="reset-password-code-error"
						tone="error"
					>
						{codeError}
					</InlineMessage>
				) : null}

				<div className="grid gap-2">
					<label
						className="text-xs font-medium text-muted-gray"
						htmlFor="reset-password-new-password"
					>
						New password
					</label>
					<span className={passwordShellClasses(Boolean(passwordError))}>
						<input
							aria-describedby={
								passwordError ? "reset-password-new-password-error" : undefined
							}
							aria-invalid={Boolean(passwordError)}
							autoComplete="new-password"
							className={authPasswordInputClasses}
							data-testid="reset-password-new-password"
							id="reset-password-new-password"
							name="password"
							placeholder="New password"
							type={showPassword ? "text" : "password"}
						/>
						<PasswordVisibilityToggle
							isVisible={showPassword}
							onToggle={() => setShowPassword((visible) => !visible)}
							testId="reset-password-new-password-toggle"
						/>
					</span>
					{passwordError ? (
						<FieldError
							id="reset-password-new-password-error"
							testId="reset-password-new-password-error"
						>
							{passwordError}
						</FieldError>
					) : null}
				</div>

				<div className="grid gap-2">
					<label
						className="text-xs font-medium text-muted-gray"
						htmlFor="reset-password-confirm-password"
					>
						Confirm new password
					</label>
					<span
						className={passwordShellClasses(Boolean(confirmPasswordError))}
					>
						<input
							aria-describedby={
								confirmPasswordError
									? "reset-password-confirm-password-error"
									: undefined
							}
							aria-invalid={Boolean(confirmPasswordError)}
							autoComplete="new-password"
							className={authPasswordInputClasses}
							data-testid="reset-password-confirm-password"
							id="reset-password-confirm-password"
							name="confirmPassword"
							placeholder="Confirm password"
							type={showConfirmPassword ? "text" : "password"}
						/>
						<PasswordVisibilityToggle
							isVisible={showConfirmPassword}
							onToggle={() =>
								setShowConfirmPassword((visible) => !visible)
							}
							testId="reset-password-confirm-password-toggle"
						/>
					</span>
					{confirmPasswordError ? (
						<FieldError
							id="reset-password-confirm-password-error"
							testId="reset-password-confirm-password-error"
						>
							{confirmPasswordError}
						</FieldError>
					) : null}
				</div>
			</div>

			<PasswordResetStatusMessage state={state} testIdPrefix="reset-password" />

			<Button
				className="group mt-6 w-full justify-start px-5 text-left transition duration-200 hover:!bg-action-hover"
				data-testid="reset-password-submit"
				disabled={isPending}
				type="submit"
			>
				<span>{isPending ? "Saving..." : "Reset password"}</span>
				<span className="ml-auto transition-transform duration-200 group-hover:translate-x-1">
					<ArrowRightIcon />
				</span>
			</Button>
		</form>
	);
}
