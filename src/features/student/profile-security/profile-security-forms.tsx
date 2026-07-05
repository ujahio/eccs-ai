"use client";

import { useActionState, useState } from "react";
import {
	AuthStatusMessage,
	PasswordVisibilityToggle,
	authPasswordInputClasses,
	fieldError,
	inputClasses,
	passwordShellClasses,
	type StatusTone,
} from "@/features/auth/form-helpers";
import type {
	StudentPasswordChangeFormState,
	StudentPersonalDetailsFormState,
} from "./state";
import {
	initialStudentPasswordChangeFormState,
	initialStudentPersonalDetailsFormState,
} from "./state";

type ProfileSecurityFormsProps = {
	currentEmail: string;
	firstName: string;
	lastName: string;
	pendingEmail?: string;
	personalDetailsAction: (
		previousState: StudentPersonalDetailsFormState,
		formData: FormData,
	) => Promise<StudentPersonalDetailsFormState>;
	passwordAction: (
		previousState: StudentPasswordChangeFormState,
		formData: FormData,
	) => Promise<StudentPasswordChangeFormState>;
};

type StatusState = {
	status: "idle" | "error" | "success" | "notice";
	message: string;
};

type TabId = "personal" | "password";
type DetailsValues = StudentPersonalDetailsFormState["values"];
type PasswordValues = StudentPasswordChangeFormState["values"];

const tabButtonBase =
	"flex min-h-11 min-w-0 flex-1 items-center justify-center border-b px-2 text-center text-[11px] font-semibold uppercase transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal sm:min-h-0 sm:flex-none sm:justify-start sm:px-0 sm:pb-3";

function StatusMessage({
	state,
	testId,
	testIdPrefix,
}: {
	state: StatusState;
	testId?: string;
	testIdPrefix: string;
}) {
	if (!state.message) {
		return null;
	}

	const tone: StatusTone =
		state.status === "success"
			? "success"
			: state.status === "notice"
				? "warning"
				: "error";
	const suffix =
		state.status === "success"
			? "success"
			: state.status === "notice"
				? "notice"
				: "error";

	return (
		<AuthStatusMessage
			role={state.status === "error" ? "alert" : "status"}
			testId={testId ?? `${testIdPrefix}-${suffix}-message`}
			tone={tone}
		>
			<span className="break-words">{state.message}</span>
		</AuthStatusMessage>
	);
}

function SaveButton({
	children,
	disabled,
	testId,
}: {
	children: string;
	disabled: boolean;
	testId: string;
}) {
	return (
		<button
			className="mt-1 flex h-11 w-full items-center justify-between rounded-[3px] bg-primary-action px-5 text-xs font-bold uppercase text-white transition hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:pointer-events-none disabled:opacity-60"
			data-testid={testId}
			disabled={disabled}
			type="submit"
		>
			<span>{children}</span>
			<span aria-hidden="true" className="text-base leading-none">
				✓
			</span>
		</button>
	);
}

function normalizeTextForComparison(value: string) {
	return value.trim();
}

function normalizeEmailForComparison(value: string) {
	return value.trim().toLowerCase();
}

function pendingEmailStatusMessage(pendingEmail?: string) {
	if (!pendingEmail) {
		return "";
	}

	return "We sent a verification link to your new email address.";
}

export function ProfileSecurityForms({
	currentEmail,
	firstName,
	lastName,
	pendingEmail,
	personalDetailsAction,
	passwordAction,
}: ProfileSecurityFormsProps) {
	const [activeTab, setActiveTab] = useState<TabId>("personal");
	const [detailsState, submitDetails, isDetailsPending] = useActionState(
		personalDetailsAction,
		initialStudentPersonalDetailsFormState({
			firstName,
			lastName,
			email: currentEmail,
		}),
	);
	const [detailsValues, setDetailsValues] = useState<DetailsValues>(() => ({
		firstName,
		lastName,
		email: currentEmail,
	}));
	const [passwordState, submitPassword, isPasswordPending] = useActionState(
		passwordAction,
		initialStudentPasswordChangeFormState,
	);
	const [passwordValues, setPasswordValues] = useState<PasswordValues>({
		currentPassword: "",
		password: "",
		confirmPassword: "",
	});
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const firstNameError = fieldError(detailsState, "firstName");
	const lastNameError = fieldError(detailsState, "lastName");
	const emailError = fieldError(detailsState, "email");
	const currentPasswordError = fieldError(passwordState, "currentPassword");
	const passwordError = fieldError(passwordState, "password");
	const confirmPasswordError = fieldError(passwordState, "confirmPassword");
	const savedDetailsValues =
		detailsState.status === "success"
			? detailsState.values
			: {
					firstName,
					lastName,
					email: currentEmail,
				};
	const hasDetailsChanges =
		normalizeTextForComparison(detailsValues.firstName) !==
			normalizeTextForComparison(savedDetailsValues.firstName) ||
		normalizeTextForComparison(detailsValues.lastName) !==
			normalizeTextForComparison(savedDetailsValues.lastName) ||
		normalizeEmailForComparison(detailsValues.email) !==
			normalizeEmailForComparison(savedDetailsValues.email);
	const isPasswordReadyToSubmit =
		passwordValues.currentPassword.length > 0 &&
		passwordValues.password.length > 0 &&
		passwordValues.confirmPassword.length > 0;
	const isEmailChangeRequestSuccess =
		detailsState.status === "success" &&
		normalizeEmailForComparison(detailsState.values.email) !==
			normalizeEmailForComparison(currentEmail);
	const displayedDetailsState =
		isEmailChangeRequestSuccess
			? { ...detailsState, message: "" }
			: detailsState;
	const pendingEmailMessage = pendingEmailStatusMessage(
		pendingEmail ??
			(isEmailChangeRequestSuccess ? detailsState.values.email : undefined),
	);

	function updateDetailsValue<Field extends keyof DetailsValues>(
		field: Field,
		value: DetailsValues[Field],
	) {
		setDetailsValues((previousValues) => ({
			...previousValues,
			[field]: value,
		}));
	}

	function updatePasswordValue<Field extends keyof PasswordValues>(
		field: Field,
		value: PasswordValues[Field],
	) {
		setPasswordValues((previousValues) => ({
			...previousValues,
			[field]: value,
		}));
	}

	function submitPasswordAndReset(formData: FormData) {
		submitPassword(formData);
		setPasswordValues({
			currentPassword: "",
			password: "",
			confirmPassword: "",
		});
	}

	return (
		<div className="border border-border-gray bg-white px-4 py-6 sm:px-10 sm:py-10">
			<div className="mx-auto w-full max-w-[760px]">
				<div
					aria-label="Profile sections"
					className="grid grid-cols-2 gap-0 border-b border-border-gray sm:flex sm:gap-9"
					role="tablist"
				>
					<button
						aria-controls="student-personal-details-panel"
						aria-selected={activeTab === "personal"}
						className={`${tabButtonBase} ${
							activeTab === "personal"
								? "border-primary-action text-primary-text"
								: "border-transparent text-muted-gray hover:text-primary-text"
						}`}
						data-testid="student-profile-personal-tab"
						onClick={() => setActiveTab("personal")}
						role="tab"
						type="button"
					>
						Personal details
					</button>
					<button
						aria-controls="student-password-panel"
						aria-selected={activeTab === "password"}
						className={`${tabButtonBase} ${
							activeTab === "password"
								? "border-primary-action text-primary-text"
								: "border-transparent text-muted-gray hover:text-primary-text"
						}`}
						data-testid="student-profile-password-tab"
						onClick={() => setActiveTab("password")}
						role="tab"
						type="button"
					>
						Password
					</button>
				</div>

				{activeTab === "personal" ? (
					<form
						action={submitDetails}
						className="mx-auto mt-5 grid w-full max-w-[520px] gap-4 sm:mt-6 sm:gap-5"
						data-testid="student-personal-details-form"
						id="student-personal-details-panel"
						role="tabpanel"
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="grid gap-2">
								<label
									className="text-xs font-medium text-muted-gray"
									htmlFor="student-profile-first-name"
								>
									First name
								</label>
								<input
									aria-describedby={
										firstNameError
											? "student-profile-first-name-error"
											: undefined
									}
									aria-invalid={Boolean(firstNameError)}
									autoComplete="given-name"
									className={inputClasses(Boolean(firstNameError))}
									data-testid="student-profile-first-name"
									id="student-profile-first-name"
									name="firstName"
									onChange={(event) =>
										updateDetailsValue("firstName", event.target.value)
									}
									type="text"
									value={detailsValues.firstName}
								/>
								{firstNameError ? (
									<p
										className="text-xs font-medium leading-5 text-error-red"
										data-testid="student-profile-first-name-error"
										id="student-profile-first-name-error"
									>
										{firstNameError}
									</p>
								) : null}
							</div>

							<div className="grid gap-2">
								<label
									className="text-xs font-medium text-muted-gray"
									htmlFor="student-profile-last-name"
								>
									Last name
								</label>
								<input
									aria-describedby={
										lastNameError
											? "student-profile-last-name-error"
											: undefined
									}
									aria-invalid={Boolean(lastNameError)}
									autoComplete="family-name"
									className={inputClasses(Boolean(lastNameError))}
									data-testid="student-profile-last-name"
									id="student-profile-last-name"
									name="lastName"
									onChange={(event) =>
										updateDetailsValue("lastName", event.target.value)
									}
									type="text"
									value={detailsValues.lastName}
								/>
								{lastNameError ? (
									<p
										className="text-xs font-medium leading-5 text-error-red"
										data-testid="student-profile-last-name-error"
										id="student-profile-last-name-error"
									>
										{lastNameError}
									</p>
								) : null}
							</div>
						</div>

						<div className="grid gap-2">
							<label
								className="text-xs font-medium text-muted-gray"
								htmlFor="student-profile-new-email"
							>
								Email address
							</label>
							<input
								aria-describedby={
									emailError ? "student-profile-new-email-error" : undefined
								}
								aria-invalid={Boolean(emailError)}
								autoComplete="email"
								className={inputClasses(Boolean(emailError))}
								data-testid="student-profile-new-email"
								id="student-profile-new-email"
								inputMode="email"
								name="email"
								onChange={(event) =>
									updateDetailsValue("email", event.target.value)
								}
								type="email"
								value={detailsValues.email}
							/>
							{emailError ? (
								<p
									className="text-xs font-medium leading-5 text-error-red"
									data-testid="student-profile-new-email-error"
									id="student-profile-new-email-error"
								>
									{emailError}
								</p>
							) : null}
							<StatusMessage
								state={{
									status: "notice",
									message: pendingEmailMessage,
								}}
								testId="student-pending-email"
								testIdPrefix="student-pending-email"
							/>
						</div>

						<StatusMessage
							state={displayedDetailsState}
							testIdPrefix="student-details"
						/>

						<SaveButton
							disabled={isDetailsPending || !hasDetailsChanges}
							testId="student-profile-details-submit"
						>
							{isDetailsPending ? "Saving..." : "Save changes"}
						</SaveButton>
					</form>
				) : (
					<form
						action={submitPasswordAndReset}
						className="mx-auto mt-5 grid w-full gap-4 sm:mt-6 sm:max-w-[360px] sm:gap-5"
						data-testid="student-password-change-form"
						id="student-password-panel"
						role="tabpanel"
					>
						<div className="grid gap-2">
							<label
								className="text-xs font-medium text-muted-gray"
								htmlFor="student-profile-current-password"
							>
								Current password
							</label>
							<span
								className={passwordShellClasses(
									Boolean(currentPasswordError),
								)}
							>
								<input
									aria-describedby={
										currentPasswordError
											? "student-profile-current-password-error"
											: undefined
									}
									aria-invalid={Boolean(currentPasswordError)}
									autoComplete="current-password"
									className={authPasswordInputClasses}
									data-testid="student-profile-current-password"
									id="student-profile-current-password"
									name="currentPassword"
									onChange={(event) =>
										updatePasswordValue(
											"currentPassword",
											event.target.value,
										)
									}
									type={showCurrentPassword ? "text" : "password"}
									value={passwordValues.currentPassword}
								/>
								<PasswordVisibilityToggle
									isVisible={showCurrentPassword}
									onToggle={() =>
										setShowCurrentPassword((visible) => !visible)
									}
									testId="student-profile-current-password-toggle"
								/>
							</span>
							{currentPasswordError ? (
								<p
									className="text-xs font-medium leading-5 text-error-red"
									data-testid="student-profile-current-password-error"
									id="student-profile-current-password-error"
								>
									{currentPasswordError}
								</p>
							) : null}
						</div>

						<div className="grid gap-2">
							<label
								className="text-xs font-medium text-muted-gray"
								htmlFor="student-profile-new-password"
							>
								New password
							</label>
							<span className={passwordShellClasses(Boolean(passwordError))}>
								<input
									aria-describedby={
										passwordError
											? "student-profile-new-password-error"
											: undefined
									}
									aria-invalid={Boolean(passwordError)}
									autoComplete="new-password"
									className={authPasswordInputClasses}
									data-testid="student-profile-new-password"
									id="student-profile-new-password"
									name="password"
									onChange={(event) =>
										updatePasswordValue("password", event.target.value)
									}
									type={showNewPassword ? "text" : "password"}
									value={passwordValues.password}
								/>
								<PasswordVisibilityToggle
									isVisible={showNewPassword}
									onToggle={() => setShowNewPassword((visible) => !visible)}
									testId="student-profile-new-password-toggle"
								/>
							</span>
							{passwordError ? (
								<p
									className="text-xs font-medium leading-5 text-error-red"
									data-testid="student-profile-new-password-error"
									id="student-profile-new-password-error"
								>
									{passwordError}
								</p>
							) : null}
						</div>

						<div className="grid gap-2">
							<label
								className="text-xs font-medium text-muted-gray"
								htmlFor="student-profile-confirm-password"
							>
								Confirm new password
							</label>
							<span
								className={passwordShellClasses(Boolean(confirmPasswordError))}
							>
								<input
									aria-describedby={
										confirmPasswordError
											? "student-profile-confirm-password-error"
											: undefined
									}
									aria-invalid={Boolean(confirmPasswordError)}
									autoComplete="new-password"
									className={authPasswordInputClasses}
									data-testid="student-profile-confirm-password"
									id="student-profile-confirm-password"
									name="confirmPassword"
									onChange={(event) =>
										updatePasswordValue(
											"confirmPassword",
											event.target.value,
										)
									}
									type={showConfirmPassword ? "text" : "password"}
									value={passwordValues.confirmPassword}
								/>
								<PasswordVisibilityToggle
									isVisible={showConfirmPassword}
									onToggle={() =>
										setShowConfirmPassword((visible) => !visible)
									}
									testId="student-profile-confirm-password-toggle"
								/>
							</span>
							{confirmPasswordError ? (
								<p
									className="text-xs font-medium leading-5 text-error-red"
									data-testid="student-profile-confirm-password-error"
									id="student-profile-confirm-password-error"
								>
									{confirmPasswordError}
								</p>
							) : null}
						</div>

						<StatusMessage
							state={passwordState}
							testIdPrefix="student-password"
						/>

						<SaveButton
							disabled={isPasswordPending || !isPasswordReadyToSubmit}
							testId="student-profile-password-submit"
						>
							{isPasswordPending ? "Saving..." : "Save changes"}
						</SaveButton>
					</form>
				)}
			</div>
		</div>
	);
}
