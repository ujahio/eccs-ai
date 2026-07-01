import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

type PublicNavProps = {
  activePage?: "home" | "faculty";
};

const navLinkClasses =
  "flex h-full items-center border-b-2 border-transparent px-1 pt-0.5 transition hover:text-brand-teal";

const activeNavLinkClasses =
  "flex h-full items-center border-b-2 border-primary-action px-1 pt-0.5 transition hover:text-brand-teal";

const mobileLinkClasses = "px-3 py-2 transition hover:text-brand-teal";

export function PublicNav({ activePage = "home" }: PublicNavProps) {
  return (
    <header className="border-b border-border-gray bg-white">
      <nav className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-2 md:h-14 md:flex-nowrap md:py-0">
        <Link href="/" aria-label="E-Clinical Case Solutions home">
          <Image
            src="/images/logo.png"
            alt="E-Clinical Case Solutions"
            className="h-7 w-auto"
            width={150}
            height={35}
            priority
          />
        </Link>
        <div className="hidden h-full items-center gap-9 text-xs font-semibold uppercase md:flex">
          <Link
            className={
              activePage === "home" ? activeNavLinkClasses : navLinkClasses
            }
            href="/"
          >
            Home
          </Link>
          <Link
            className={
              activePage === "faculty" ? activeNavLinkClasses : navLinkClasses
            }
            href="/faculty"
          >
            Faculty
          </Link>
          <Link className={navLinkClasses} href="/#workflow">
            How It Works
          </Link>
        </div>
        <details className="relative md:hidden">
          <summary
            aria-label="Open navigation menu"
            className="flex h-9 w-11 cursor-pointer list-none items-center justify-center rounded border border-border-gray bg-white text-primary-text transition hover:border-primary-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal [&::-webkit-details-marker]:hidden"
            data-testid="mobile-nav-toggle"
          >
            <span className="grid gap-1" aria-hidden="true">
              <span className="h-0.5 w-5 bg-current" />
              <span className="h-0.5 w-5 bg-current" />
              <span className="h-0.5 w-5 bg-current" />
            </span>
          </summary>
          <div className="absolute right-0 top-11 z-10 grid w-48 gap-1 rounded border border-border-gray bg-white p-2 text-xs font-semibold uppercase shadow-soft">
            <Link className={mobileLinkClasses} href="/">
              Home
            </Link>
            <Link className={mobileLinkClasses} href="/faculty">
              Faculty
            </Link>
            <Link className={mobileLinkClasses} href="/#workflow">
              How It Works
            </Link>
            <Link className={mobileLinkClasses} href="/login">
              Log in
            </Link>
            <Link className={mobileLinkClasses} href="/register">
              Get started
            </Link>
          </div>
        </details>
        <div className="hidden items-center gap-3 md:flex">
          <ButtonLink href="/login" size="sm" variant="secondary">
            Log in
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Get started
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}
