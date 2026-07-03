"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
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
	type LoginFormState
} from "./state";
import type { CognitoSignInResponse } from "./api";

type LoginFormProps = {
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

export function LoginForm({ initialState }: LoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState(initialState ?? initialLoginFormState);
  const [isPending, setIsPending] = useState(false);
  const emailError = fieldError(state, "email");
  const passwordError = fieldError(state, "password");

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
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const result = (await response.json()) as CognitoSignInResponse;

      if (result.status === "signed_in") {
        setState({
          status: "success",
          message: result.message,
          values: {
            email,
            password: ""
          },
          errors: {}
        });
        router.replace(result.redirectTo);
        router.refresh();
        return;
      }

      setState({
        status: result.status === "verify_email" ? "blocked" : "error",
        message: result.message,
        values: result.values,
        errors: result.errors
      });
    } catch {
      setState({
        status: "error",
        message: "We could not sign you in. Please try again.",
        values: {
          email,
          password: ""
        },
        errors: {}
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      className="mt-6"
      action="/api/auth/cognito/sign-in"
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
