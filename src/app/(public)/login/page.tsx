import Image from "next/image";
import Link from "next/link";
import { submitLoginForm } from "@/features/auth/login/actions";
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const verification = Array.isArray(params?.verification)
    ? params?.verification[0]
    : params?.verification;
  const verificationState = verification
    ? verificationMessages[verification]
    : undefined;
  const initialState: LoginFormState = verificationState
    ? {
        ...initialLoginFormState,
        ...verificationState
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

          <LoginForm action={submitLoginForm} initialState={initialState} />

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
