import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/arrow-right-icon";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
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

          <div className="mt-6 grid gap-5">
            <label className="grid gap-2 text-xs font-medium text-muted-gray">
              Email Address
              <input
                className="h-11 border border-border-gray bg-white px-3 text-sm text-primary-text outline-none transition placeholder:text-disabled-gray focus:border-brand-teal"
                data-testid="login-email"
                placeholder="johndoe@gmail.com"
                type="email"
              />
            </label>
            <label className="grid gap-2 text-xs font-medium text-muted-gray">
              Password
              <span className="flex h-11 items-center border border-border-gray bg-white focus-within:border-brand-teal">
                <input
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm text-primary-text outline-none placeholder:text-disabled-gray"
                  data-testid="login-password"
                  placeholder="Password"
                  type="password"
                />
                <button
                  className="h-full px-3 text-[10px] font-bold uppercase text-primary-action"
                  type="button"
                >
                  Show
                </button>
              </span>
            </label>
          </div>

          <Link
            className="mt-4 inline-flex text-[11px] font-bold uppercase underline underline-offset-2"
            href="#"
          >
            Forgot your password?
          </Link>

          <Button
            className="relative mt-7 w-full px-5"
            data-testid="login-submit"
            type="button"
          >
            <span>Sign in</span>
            <span aria-hidden="true" className="absolute right-5">
              <ArrowRightIcon />
            </span>
          </Button>

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
