"use client";

import { useActionState, useState } from "react";
import { ArrowRightIcon } from "@/components/ui/arrow-right-icon";
import { Button } from "@/components/ui/button";
import {
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
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const emailError = fieldError(state, "email");
	const codeError = fieldError(state, "code");
	const passwordError = fieldError(state, "password");
	const confirmPasswordError = fieldError(state, "confirmPassword");

	return (
		<form action={formAction} className="mt-7" data-testid="reset-password-form">
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
						<p
							className="text-xs font-medium leading-5 text-error-red"
							data-testid="reset-password-email-error"
							id="reset-password-email-error"
						>
							{emailError}
						</p>
					) : null}
				</div>

				{codeError ? (
					<p
						className="border border-error-red bg-white px-4 py-3 text-sm leading-6 text-error-red"
						data-testid="reset-password-code-error"
					>
						{codeError}
					</p>
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
						<p
							className="text-xs font-medium leading-5 text-error-red"
							data-testid="reset-password-new-password-error"
							id="reset-password-new-password-error"
						>
							{passwordError}
						</p>
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
						<p
							className="text-xs font-medium leading-5 text-error-red"
							data-testid="reset-password-confirm-password-error"
							id="reset-password-confirm-password-error"
						>
							{confirmPasswordError}
						</p>
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
