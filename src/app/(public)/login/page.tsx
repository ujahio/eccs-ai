import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login/login-form";
import {
  initialLoginFormState,
  type LoginFormState
} from "@/features/auth/login/state";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const verificationMessages: Record<
  string,
  Pick<LoginFormState, "status" | "message">
> = {
  verified: {
    status: "success",
    message: "Your email has been verified. Please sign in."
  },
  expired: {
    status: "blocked",
    message: "This verification link has expired."
  },
  invalid: {
    status: "error",
    message: "This verification link is invalid."
  },
  used: {
    status: "blocked",
    message: "This verification link has already been used."
  }
};

const authMessages: Record<string, Pick<LoginFormState, "status" | "message">> =
  {
    verify_email: {
      status: "blocked",
      message: "Verify your email before signing in."
    },
    validation_error: {
      status: "error",
      message: "Check the highlighted fields and try again."
    },
    invalid_credentials: {
      status: "error",
      message: "Invalid email or password."
    },
    missing_profile: {
      status: "error",
      message: "We could not load your account profile."
    },
    unauthorized_role: {
      status: "error",
      message: "This sign-in area is for student accounts."
    },
    invalid_request: {
      status: "error",
      message: "Invalid sign-in request."
    }
  };

const resetMessages: Record<string, Pick<LoginFormState, "status" | "message">> =
  {
    changed: {
      status: "success",
      message: "Your password was changed. Please sign in."
    }
  };

const emailChangeMessages: Record<
  string,
  Pick<LoginFormState, "status" | "message">
> = {
  verified: {
    status: "success",
    message: "Your email address has been updated. Please sign in."
  },
  expired: {
    status: "blocked",
    message: "This email change link has expired."
  },
  invalid: {
    status: "error",
    message: "This email change link is invalid."
  },
  used: {
    status: "blocked",
    message: "This email change link has already been used."
  }
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const verification = Array.isArray(params?.verification)
    ? params?.verification[0]
    : params?.verification;
  const auth = Array.isArray(params?.auth)
    ? params?.auth[0]
    : params?.auth;
  const reset = Array.isArray(params?.reset)
    ? params?.reset[0]
    : params?.reset;
  const emailChange = Array.isArray(params?.emailChange)
    ? params?.emailChange[0]
    : params?.emailChange;
  const hasVerificationParam = params?.verification !== undefined;
  const hasAuthParam = params?.auth !== undefined;
  const hasResetParam = params?.reset !== undefined;
  const hasEmailChangeParam = params?.emailChange !== undefined;
  const verificationState = verification
    ? verificationMessages[verification]
    : undefined;
  const authState = auth ? authMessages[auth] : undefined;
  const resetState = reset ? resetMessages[reset] : undefined;
  const emailChangeState = emailChange
    ? emailChangeMessages[emailChange]
    : undefined;

  if (
    (hasVerificationParam && !verificationState) ||
    (hasAuthParam && !authState) ||
    (hasResetParam && !resetState) ||
    (hasEmailChangeParam && !emailChangeState)
  ) {
    redirect("/login");
  }

  const statusState =
    verificationState ?? authState ?? resetState ?? emailChangeState;
  const initialState: LoginFormState = statusState
    ? {
        ...initialLoginFormState,
        ...statusState
      }
    : initialLoginFormState;

  return (
    <main className="min-h-screen bg-app-canvas text-primary-text">
      <section className="mx-auto flex min-h-screen w-full max-w-[430px] items-center px-5 py-10 sm:px-6">
        <div className="w-full border border-border-gray bg-white px-7 py-8 sm:px-8">
          <Link className="inline-flex" href="/">
            <Image
              src="/images/logo.png"
              alt="E-Clinical Case Solutions"
              className="h-auto w-[118px]"
              width={150}
              height={35}
              priority
            />
          </Link>

          <h1
            className="mt-8 text-base font-semibold"
            data-testid="login-heading"
          >
            Sign in to Your Account
          </h1>

          <LoginForm initialState={initialState} />

          <p className="mt-7 border-t border-border-gray pt-5 text-sm text-muted-gray">
            New User?{" "}
            <Link
              className="font-semibold text-primary-text underline"
              href="/register"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
