"use client";

import { useActionState, useState } from "react";
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
import { PASSWORD_REQUIREMENTS, failedPasswordRequirements } from "./schema";
import type { PasswordRequirement } from "./schema";
import {
	initialRegistrationFormState,
	type RegistrationAction,
	type RegistrationFormState,
} from "./state";

type RegistrationFormProps = {
	action: RegistrationAction;
	initialState?: RegistrationFormState;
};

function PasswordRequirements({
	failedRequirementIds,
	password,
	showFailed,
}: {
	failedRequirementIds?: PasswordRequirement["id"][];
	password: string;
	showFailed: boolean;
}) {
	const failedIds = new Set(
		password
			? failedPasswordRequirements(password).map((requirement) => requirement.id)
			: (failedRequirementIds ?? []),
	);
	const failedRequirements = PASSWORD_REQUIREMENTS.filter((requirement) =>
		failedIds.has(requirement.id),
	);

	if (!showFailed || failedRequirements.length === 0) {
		return null;
	}

	return (
		<ul
			className="grid gap-1 text-xs leading-5"
			data-testid="register-password-requirements"
			id="register-password-requirements"
		>
			{failedRequirements.map((requirement) => {
				return (
					<li
						className="text-error-red"
						data-testid={`register-password-requirement-${requirement.id}`}
						key={requirement.id}
					>
						Required: {requirement.label}
					</li>
				);
			})}
		</ul>
	);
}

function StatusMessage({ state }: { state: RegistrationFormState }) {
	if (!state.message) {
		return null;
	}

	const isSuccess = state.status === "success";
	const isNotice = state.status === "notice";
	const tone: StatusTone = isSuccess
		? "success"
		: isNotice
			? "warning"
			: "error";
	const testId = isSuccess
		? "register-success-message"
		: isNotice
			? "register-resend-notice"
			: "register-error-message";

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

function PasswordField({
	failedRequirementIds,
	passwordError,
}: {
	failedRequirementIds: PasswordRequirement["id"][];
	passwordError?: string;
}) {
	const [showPassword, setShowPassword] = useState(false);
	const [passwordValue, setPasswordValue] = useState("");
	const showFailedPasswordRequirements = Boolean(passwordError);

	return (
		<div className="grid gap-2">
			<label
				className="text-xs font-medium text-muted-gray"
				htmlFor="register-password"
			>
				Password
			</label>
			<span className={passwordShellClasses(Boolean(passwordError))}>
				<input
					aria-describedby={
						passwordError
							? "register-password-error register-password-requirements"
							: undefined
					}
					aria-invalid={Boolean(passwordError)}
					autoComplete="new-password"
					className={authPasswordInputClasses}
					data-testid="register-password"
					id="register-password"
					name="password"
					onChange={(event) => setPasswordValue(event.target.value)}
					placeholder="Password"
					type={showPassword ? "text" : "password"}
					value={passwordValue}
				/>
				<PasswordVisibilityToggle
					isVisible={showPassword}
					onToggle={() => setShowPassword((visible) => !visible)}
					testId="register-password-toggle"
				/>
			</span>
			<PasswordRequirements
				failedRequirementIds={failedRequirementIds}
				password={passwordValue}
				showFailed={showFailedPasswordRequirements}
			/>
			{passwordError ? (
				<p
					className="text-xs font-medium leading-5 text-error-red"
					data-testid="register-password-error"
					id="register-password-error"
				>
					{passwordError}
				</p>
			) : null}
		</div>
	);
}

export function RegistrationForm({
	action,
	initialState,
}: RegistrationFormProps) {
	const [state, formAction, isPending] = useActionState(
		action,
		initialState ?? initialRegistrationFormState,
	);
	const firstNameError = fieldError(state, "firstName");
	const lastNameError = fieldError(state, "lastName");
	const emailError = fieldError(state, "email");
	const passwordError = fieldError(state, "password");
	const passwordFieldKey =
		state.status === "success" ? `success-${state.message}` : "editing";

	return (
		<form action={formAction} className="mt-7" data-testid="register-form">
			<div className="grid gap-5">
				<div className="grid items-start gap-5 sm:grid-cols-2">
					<div className="grid gap-2">
						<label
							className="text-xs font-medium leading-none text-muted-gray"
							htmlFor="register-first-name"
						>
							First name
						</label>
						<input
							aria-describedby={
								firstNameError ? "register-first-name-error" : undefined
							}
							aria-invalid={Boolean(firstNameError)}
							autoComplete="given-name"
							className={inputClasses(Boolean(firstNameError))}
							data-testid="register-first-name"
							defaultValue={state.values.firstName}
							id="register-first-name"
							name="firstName"
							placeholder="Jordan"
							type="text"
						/>
						{firstNameError ? (
							<p
								className="text-xs font-medium leading-5 text-error-red"
								data-testid="register-first-name-error"
								id="register-first-name-error"
							>
								{firstNameError}
							</p>
						) : null}
					</div>

					<div className="grid gap-2">
						<label
							className="text-xs font-medium leading-none text-muted-gray"
							htmlFor="register-last-name"
						>
							Last name
						</label>
						<input
							aria-describedby={
								lastNameError ? "register-last-name-error" : undefined
							}
							aria-invalid={Boolean(lastNameError)}
							autoComplete="family-name"
							className={inputClasses(Boolean(lastNameError))}
							data-testid="register-last-name"
							defaultValue={state.values.lastName}
							id="register-last-name"
							name="lastName"
							placeholder="Adebayo"
							type="text"
						/>
						{lastNameError ? (
							<p
								className="text-xs font-medium leading-5 text-error-red"
								data-testid="register-last-name-error"
								id="register-last-name-error"
							>
								{lastNameError}
							</p>
						) : null}
					</div>
				</div>

				<div className="grid gap-2">
					<label
						className="text-xs font-medium text-muted-gray"
						htmlFor="register-email"
					>
						Email address
					</label>
					<input
						aria-describedby={emailError ? "register-email-error" : undefined}
						aria-invalid={Boolean(emailError)}
						autoComplete="email"
						className={inputClasses(Boolean(emailError))}
						data-testid="register-email"
						defaultValue={state.values.email}
						id="register-email"
						inputMode="email"
						name="email"
						placeholder="jordan@example.com"
						type="email"
					/>
					{emailError ? (
						<p
							className="text-xs font-medium leading-5 text-error-red"
							data-testid="register-email-error"
							id="register-email-error"
						>
							{emailError}
						</p>
					) : null}
				</div>

				<PasswordField
					key={passwordFieldKey}
					passwordError={passwordError}
					failedRequirementIds={state.failedPasswordRequirementIds}
				/>
			</div>

			<StatusMessage state={state} />

			<Button
				className="group mt-6 w-full justify-start px-5 text-left transition duration-200 hover:!bg-action-hover"
				data-testid="register-submit"
				disabled={isPending}
				type="submit"
			>
				<span>{isPending ? "Submitting..." : "Continue"}</span>
				<span className="ml-auto transition-transform duration-200 group-hover:translate-x-1">
					<ArrowRightIcon />
				</span>
			</Button>
		</form>
	);
}
