"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRightIcon } from "@/components/ui/arrow-right-icon";
import { Button } from "@/components/ui/button";
import {
	initialLoginFormState,
	type LoginAction,
	type LoginField,
	type LoginFormState
} from "./state";

type LoginFormProps = {
  action: LoginAction;
  initialState?: LoginFormState;
};

const inputBaseClasses =
  "h-11 w-full border bg-white px-3 text-sm text-primary-text outline-none transition placeholder:text-disabled-gray focus:border-brand-teal";

const passwordShellBaseClasses =
  "flex h-11 items-center border bg-white transition focus-within:border-brand-teal";

function fieldError(
  state: LoginFormState,
  field: LoginField
): string | undefined {
  return state.errors[field]?.[0];
}

function inputClasses(hasError: boolean) {
  return `${inputBaseClasses} ${
    hasError ? "border-error-red focus:border-error-red" : "border-border-gray"
  }`;
}

function passwordShellClasses(hasError: boolean) {
  return `${passwordShellBaseClasses} ${
    hasError
      ? "border-error-red focus-within:border-error-red"
      : "border-border-gray"
  }`;
}

function StatusMessage({ state }: { state: LoginFormState }) {
  if (!state.message) {
    return null;
  }

  const isBlocked = state.status === "blocked";
  const isSuccess = state.status === "success";

  return (
    <p
      aria-live="polite"
      className={`mt-6 border px-4 py-3 text-sm leading-6 ${
        isSuccess
          ? "border-success-mint bg-success-soft text-primary-text"
          : isBlocked
          ? "border-warning-gold bg-app-canvas text-primary-text"
          : "border-error-red bg-white text-error-red"
      }`}
      data-testid={
        isSuccess
          ? "login-success-message"
          : isBlocked
            ? "login-blocked-message"
            : "login-error-message"
      }
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
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
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-primary-text outline-none placeholder:text-disabled-gray"
              data-testid="login-password"
              defaultValue={state.values.password}
              id="login-password"
              key={`login-password-${state.status}-${state.message}`}
              name="password"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="h-full px-3 text-[10px] font-bold uppercase text-primary-action transition hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
              data-testid="login-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
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
