"use client";

import Link from "next/link";
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
	type StatusTone
} from "@/features/auth/form-helpers";
import {
	initialLoginFormState,
	type LoginAction,
	type LoginFormState
} from "./state";

type LoginFormProps = {
  action: LoginAction;
  initialState?: LoginFormState;
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

export function LoginForm({ action, initialState }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(
    action,
    initialState ?? initialLoginFormState
  );
  const emailError = fieldError(state, "email");
  const passwordError = fieldError(state, "password");

  return (
    <form action={formAction} className="mt-6" data-testid="login-form">
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
        href="#"
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
