"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRightIcon } from "@/components/ui/arrow-right-icon";
import { Button } from "@/components/ui/button";
import {
	AuthStatusMessage,
	PasswordVisibilityToggle,
	authPasswordInputClasses,
	fieldError,
	inputClasses,
	passwordShellClasses,
	type StatusTone,
} from "@/features/auth/form-helpers";
import { initialLoginFormState, type LoginFormState } from "./state";
import type {
	CognitoCompleteNewPasswordResponse,
	CognitoSignInResponse,
} from "./api";

type LoginFormProps = {
	initialState?: LoginFormState;
};

type CompleteNewPasswordState = {
	status: "idle" | "error" | "blocked";
	message: string;
	errors: Partial<Record<"password" | "confirmPassword", string[]>>;
};

const initialCompleteNewPasswordState: CompleteNewPasswordState = {
	status: "idle",
	message: "",
	errors: {},
};

function StatusMessage({ state }: { state: LoginFormState }) {
	if (!state.message) {
		return null;
	}

	const isBlocked = state.status === "blocked";
	const isSuccess = state.status === "success";
	const tone: StatusTone = isSuccess
		? "success"
		: isBlocked
			? "warning"
			: "error";
	const testId = isSuccess
		? "login-success-message"
		: isBlocked
			? "login-blocked-message"
			: "login-error-message";

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

function CompletePasswordStatusMessage({
	state,
}: {
	state: CompleteNewPasswordState;
}) {
	if (!state.message) {
		return null;
	}

	const isBlocked = state.status === "blocked";

	return (
		<AuthStatusMessage
			role={state.status === "error" ? "alert" : "status"}
			testId={
				isBlocked
					? "teacher-first-login-password-blocked-message"
					: "teacher-first-login-password-error-message"
			}
			tone={isBlocked ? "warning" : "error"}
		>
			{state.message}
		</AuthStatusMessage>
	);
}

export function LoginForm({ initialState }: LoginFormProps) {
	const router = useRouter();
	const [isClientReady, setIsClientReady] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [state, setState] = useState(initialState ?? initialLoginFormState);
	const [completePasswordState, setCompletePasswordState] = useState(
		initialCompleteNewPasswordState,
	);
	const [passwordChallenge, setPasswordChallenge] = useState<{
		email: string;
		challengeSession: string;
	} | null>(null);
	const [isPending, setIsPending] = useState(false);
	const [isCompletingPassword, setIsCompletingPassword] = useState(false);
	const emailError = fieldError(state, "email");
	const passwordError = fieldError(state, "password");
	const newPasswordError = fieldError(completePasswordState, "password");
	const confirmPasswordError = fieldError(
		completePasswordState,
		"confirmPassword",
	);

	useEffect(() => {
		setIsClientReady(true);
	}, []);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsPending(true);

		const formData = new FormData(event.currentTarget);
		const email = String(formData.get("email") ?? "");
		const password = String(formData.get("password") ?? "");

		try {
			const response = await fetch("/api/auth/cognito/sign-in", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, password }),
			});
			const result = (await response.json()) as CognitoSignInResponse;

			if (result.status === "signed_in") {
				router.replace(result.redirectTo);
				router.refresh();
				return;
			}

			if (result.status === "new_password_required") {
				setPasswordChallenge({
					email: result.values.email || email,
					challengeSession: result.challengeSession,
				});
				setCompletePasswordState({
					status: "blocked",
					message: result.message,
					errors: {},
				});
				return;
			}

			setState({
				status: result.status === "verify_email" ? "blocked" : "error",
				message: result.message,
				values: result.values,
				errors: result.errors,
			});
		} catch {
			setState({
				status: "error",
				message: "We could not sign you in. Please try again.",
				values: {
					email,
					password: "",
				},
				errors: {},
			});
		} finally {
			setIsPending(false);
		}
	}

	async function handleCompleteNewPassword(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!passwordChallenge) {
			return;
		}

		setIsCompletingPassword(true);

		const formData = new FormData(event.currentTarget);
		const password = String(formData.get("password") ?? "");
		const confirmPassword = String(formData.get("confirmPassword") ?? "");

		try {
			const response = await fetch("/api/auth/cognito/complete-new-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: passwordChallenge.email,
					password,
					confirmPassword,
					challengeSession: passwordChallenge.challengeSession,
				}),
			});
			const result =
				(await response.json()) as CognitoCompleteNewPasswordResponse;

			if (result.status === "signed_in") {
				router.replace(result.redirectTo);
				router.refresh();
				return;
			}

			setCompletePasswordState({
				status: result.status === "verify_email" ? "blocked" : "error",
				message: result.message,
				errors: result.errors,
			});
		} catch {
			setCompletePasswordState({
				status: "error",
				message: "We could not set your password. Please try again.",
				errors: {},
			});
		} finally {
			setIsCompletingPassword(false);
		}
	}

	if (passwordChallenge) {
		return (
			<form
				className="mt-6"
				data-testid="teacher-first-login-password-form"
				onSubmit={handleCompleteNewPassword}
			>
				<div className="mt-5 grid gap-5">
					<div className="grid gap-2">
						<label
							className="text-xs font-medium text-muted-gray"
							htmlFor="teacher-first-login-new-password"
						>
							New password
						</label>
						<span className={passwordShellClasses(Boolean(newPasswordError))}>
							<input
								aria-describedby={
									newPasswordError
										? "teacher-first-login-new-password-error"
										: undefined
								}
								aria-invalid={Boolean(newPasswordError)}
								autoComplete="new-password"
								className={authPasswordInputClasses}
								data-testid="teacher-first-login-new-password"
								id="teacher-first-login-new-password"
								name="password"
								placeholder="New password"
								type={showNewPassword ? "text" : "password"}
							/>
							<PasswordVisibilityToggle
								isVisible={showNewPassword}
								onToggle={() => setShowNewPassword((visible) => !visible)}
								testId="teacher-first-login-new-password-toggle"
							/>
						</span>
						{newPasswordError ? (
							<p
								className="text-xs font-medium leading-5 text-error-red"
								data-testid="teacher-first-login-new-password-error"
								id="teacher-first-login-new-password-error"
							>
								{newPasswordError}
							</p>
						) : null}
					</div>

					<div className="grid gap-2">
						<label
							className="text-xs font-medium text-muted-gray"
							htmlFor="teacher-first-login-confirm-password"
						>
							Confirm new password
						</label>
						<span
							className={passwordShellClasses(Boolean(confirmPasswordError))}
						>
							<input
								aria-describedby={
									confirmPasswordError
										? "teacher-first-login-confirm-password-error"
										: undefined
								}
								aria-invalid={Boolean(confirmPasswordError)}
								autoComplete="new-password"
								className={authPasswordInputClasses}
								data-testid="teacher-first-login-confirm-password"
								id="teacher-first-login-confirm-password"
								name="confirmPassword"
								placeholder="Confirm new password"
								type={showConfirmPassword ? "text" : "password"}
							/>
							<PasswordVisibilityToggle
								isVisible={showConfirmPassword}
								onToggle={() => setShowConfirmPassword((visible) => !visible)}
								testId="teacher-first-login-confirm-password-toggle"
							/>
						</span>
						{confirmPasswordError ? (
							<p
								className="text-xs font-medium leading-5 text-error-red"
								data-testid="teacher-first-login-confirm-password-error"
								id="teacher-first-login-confirm-password-error"
							>
								{confirmPasswordError}
							</p>
						) : null}
					</div>
				</div>

				<CompletePasswordStatusMessage state={completePasswordState} />

				<Button
					className="relative mt-7 w-full px-5 hover:!bg-action-hover"
					data-testid="teacher-first-login-password-submit"
					disabled={isCompletingPassword}
					type="submit"
				>
					<span>{isCompletingPassword ? "Saving..." : "Set password"}</span>
					<span aria-hidden="true" className="absolute right-5">
						<ArrowRightIcon />
					</span>
				</Button>

				<button
					className="mt-4 text-[11px] font-bold uppercase underline underline-offset-2"
					data-testid="teacher-first-login-password-back"
					onClick={() => {
						setPasswordChallenge(null);
						setCompletePasswordState(initialCompleteNewPasswordState);
					}}
					type="button"
				>
					Back to sign in
				</button>
			</form>
		);
	}

	return (
		<form
			className="mt-6"
			action="/api/auth/cognito/sign-in"
			data-client-ready={isClientReady ? "true" : "false"}
			data-testid="login-form"
			method="post"
			onSubmit={handleSubmit}
		>
			<div className="grid gap-5">
				<div className="grid gap-2">
					<label
						className="text-xs font-medium text-muted-gray"
						htmlFor="login-email"
					>
						Email address
					</label>
					<input
						aria-describedby={emailError ? "login-email-error" : undefined}
						aria-invalid={Boolean(emailError)}
						autoComplete="email"
						className={inputClasses(Boolean(emailError))}
						data-testid="login-email"
						defaultValue={state.values.email}
						id="login-email"
						inputMode="email"
						name="email"
						placeholder="jordan@example.com"
						type="email"
					/>
					{emailError ? (
						<p
							className="text-xs font-medium leading-5 text-error-red"
							data-testid="login-email-error"
							id="login-email-error"
						>
							{emailError}
						</p>
					) : null}
				</div>

				<div className="grid gap-2">
					<label
						className="text-xs font-medium text-muted-gray"
						htmlFor="login-password"
					>
						Password
					</label>
					<span className={passwordShellClasses(Boolean(passwordError))}>
						<input
							aria-describedby={
								passwordError ? "login-password-error" : undefined
							}
							aria-invalid={Boolean(passwordError)}
							autoComplete="current-password"
							className={authPasswordInputClasses}
							data-testid="login-password"
							defaultValue={state.values.password}
							id="login-password"
							key={`login-password-${state.status}-${state.message}`}
							name="password"
							placeholder="Password"
							type={showPassword ? "text" : "password"}
						/>
						<PasswordVisibilityToggle
							isVisible={showPassword}
							onToggle={() => setShowPassword((visible) => !visible)}
							testId="login-password-toggle"
						/>
					</span>
					{passwordError ? (
						<p
							className="text-xs font-medium leading-5 text-error-red"
							data-testid="login-password-error"
							id="login-password-error"
						>
							{passwordError}
						</p>
					) : null}
				</div>
			</div>

			<StatusMessage state={state} />

			<Link
				className="mt-4 inline-flex text-[11px] font-bold uppercase underline underline-offset-2"
				data-testid="login-forgot-password"
				href="/forgot-password"
			>
				Forgot your password?
			</Link>

			<Button
				className="relative mt-7 w-full px-5 hover:!bg-action-hover"
				data-testid="login-submit"
				disabled={isPending}
				type="submit"
			>
				<span>{isPending ? "Signing in..." : "Sign in"}</span>
				<span aria-hidden="true" className="absolute right-5">
					<ArrowRightIcon />
				</span>
			</Button>
		</form>
	);
}
