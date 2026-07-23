import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { publicDashboardActionForRole } from "@/lib/auth/public-navigation";
import { type AppRole, type RoleRedirectPath } from "@/lib/auth/roles";
import { getOptionalAppSession } from "@/lib/auth/session";

type PublicNavProps = {
  activePage?: "home" | "faculty";
};

type AccountConfig = {
  dashboardHref: RoleRedirectPath;
  dashboardLabel: string;
  dashboardTestId: string;
  menuId: string;
  menuTestId: string;
  profileHref: "/student/profile" | "/teacher/profile";
  profileTestId: string;
  triggerTestId: string;
};

const navLinkClasses =
  "flex h-full items-center border-b-2 border-transparent px-1 pt-0.5 transition hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal";

const activeNavLinkClasses =
  "flex h-full items-center border-b-2 border-primary-action px-1 pt-0.5 transition hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal";

const mobileLinkClasses =
  "flex min-h-11 items-center px-3 py-2 transition hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal";

const accountMenuLinkClasses =
  "flex min-h-11 w-full items-center px-4 py-2.5 text-left text-sm font-medium leading-5 text-primary-text transition hover:bg-app-canvas hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-teal";

const accountSummaryClasses =
  "flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded border border-border-gray bg-white text-primary-text transition hover:border-primary-action hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal sm:w-auto sm:max-w-[16rem] sm:justify-start sm:gap-2 sm:border-0 sm:bg-transparent sm:text-sm sm:font-semibold [&::-webkit-details-marker]:hidden";

function publicAccountConfig(role: AppRole): AccountConfig {
  const rolePrefix = role === "teacher" ? "teacher" : "student";
  const dashboardAction = publicDashboardActionForRole(role);

  return {
    dashboardHref: dashboardAction.href,
    dashboardLabel: dashboardAction.label,
    dashboardTestId: `public-nav-${rolePrefix}-dashboard`,
    menuId: `${rolePrefix}-account-menu`,
    menuTestId: `${rolePrefix}-account-menu`,
    profileHref: role === "teacher" ? "/teacher/profile" : "/student/profile",
    profileTestId: `${rolePrefix}-account-menu-profile`,
    triggerTestId: `${rolePrefix}-account-menu-trigger`,
  };
}

type OptionalAppSession = Awaited<ReturnType<typeof getOptionalAppSession>>;

function shortProfileName(fullName: string) {
  const [firstName, lastName] = fullName.trim().split(/\s+/);

  if (!firstName) {
    return "Profile";
  }

  return lastName ? `${firstName} ${lastName[0]}.` : firstName;
}

export async function PublicNav({
  activePage = "home",
  appSession: providedAppSession,
}: PublicNavProps & { appSession?: OptionalAppSession }) {
  const appSession =
    providedAppSession === undefined
      ? await getOptionalAppSession()
      : providedAppSession;
  const accountConfig = appSession
    ? publicAccountConfig(appSession.profile.role)
    : null;
  const displayName = appSession
    ? shortProfileName(appSession.profile.fullName)
    : "";

  return (
    <header className="border-b border-border-gray bg-white">
      <nav className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-2 md:h-14 md:flex-nowrap md:py-0">
        <Link
          aria-label="E-Clinical Case Solutions home"
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal"
          href="/"
        >
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
        {appSession && accountConfig ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <ButtonLink
              className="min-h-11 px-3 md:min-h-0"
              data-testid={accountConfig.dashboardTestId}
              href={accountConfig.dashboardHref}
              size="sm"
            >
              {accountConfig.dashboardLabel}
            </ButtonLink>
            <details className="relative">
              <summary
                aria-label={`Open menu for ${appSession.profile.fullName}`}
                className={accountSummaryClasses}
                data-testid={accountConfig.triggerTestId}
              >
                <span className="grid gap-1 sm:hidden" aria-hidden="true">
                  <span className="h-0.5 w-5 bg-current" />
                  <span className="h-0.5 w-5 bg-current" />
                  <span className="h-0.5 w-5 bg-current" />
                </span>
                <span className="hidden min-w-0 truncate leading-none sm:inline">
                  {displayName}
                </span>
                <svg
                  aria-hidden="true"
                  className="hidden h-4 w-4 shrink-0 sm:block"
                  fill="none"
                  viewBox="0 0 16 16"
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </summary>
              <div
                className="absolute right-0 top-11 z-10 grid w-56 rounded border border-border-gray bg-white py-2 shadow-soft"
                data-testid={accountConfig.menuTestId}
                id={accountConfig.menuId}
              >
                <div className="border-b border-border-gray px-4 py-3 sm:hidden">
                  <p className="text-xs font-semibold uppercase text-muted-gray">
                    Signed In
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-primary-text">
                    {displayName}
                  </p>
                </div>
                <Link
                  className={`${accountMenuLinkClasses} md:hidden`}
                  data-testid={`${accountConfig.menuId}-dashboard`}
                  href={accountConfig.dashboardHref}
                >
                  {accountConfig.dashboardLabel}
                </Link>
                {appSession.profile.role === "student" ? (
                  <Link
                    className={accountMenuLinkClasses}
                    data-testid="student-account-menu-certificates"
                    href="/student/certificates"
                  >
                    Certificates
                  </Link>
                ) : null}
                <Link
                  className={accountMenuLinkClasses}
                  data-testid={accountConfig.profileTestId}
                  href={accountConfig.profileHref}
                >
                  Profile
                </Link>
                <Link
                  className={`${accountMenuLinkClasses} md:hidden`}
                  data-testid={`${accountConfig.menuId}-home`}
                  href="/"
                >
                  Home
                </Link>
                <Link
                  className={`${accountMenuLinkClasses} md:hidden`}
                  data-testid={`${accountConfig.menuId}-faculty`}
                  href="/faculty"
                >
                  Faculty
                </Link>
                <Link
                  className={`${accountMenuLinkClasses} md:hidden`}
                  data-testid={`${accountConfig.menuId}-workflow`}
                  href="/#workflow"
                >
                  How It Works
                </Link>
              </div>
            </details>
          </div>
        ) : (
          <>
            <details className="relative md:hidden">
              <summary
                aria-label="Open navigation menu"
                className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded border border-border-gray bg-white text-primary-text transition hover:border-primary-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal [&::-webkit-details-marker]:hidden"
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
                <Link
                  className={mobileLinkClasses}
                  data-testid="mobile-nav-login"
                  href="/login"
                >
                  Log in
                </Link>
                <Link
                  className={mobileLinkClasses}
                  data-testid="mobile-nav-register"
                  href="/register"
                >
                  Get started
                </Link>
              </div>
            </details>
            <div className="hidden items-center gap-3 md:flex">
              <ButtonLink
                data-testid="public-nav-login"
                href="/login"
                size="sm"
                variant="secondary"
              >
                Log in
              </ButtonLink>
              <ButtonLink
                data-testid="public-nav-register"
                href="/register"
                size="sm"
              >
                Get started
              </ButtonLink>
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
