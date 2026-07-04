import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/features/auth/logout/logout-button";
import { requireStudentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  await requireStudentSession();

  return (
    <main className="min-h-screen bg-app-canvas text-primary-text">
      <header className="border-b border-border-gray bg-white">
        <nav className="mx-auto grid min-h-16 w-full max-w-6xl grid-cols-1 items-center gap-3 px-6 py-3 sm:grid-cols-[1fr_auto_1fr] sm:py-0">
          <Link className="text-base font-semibold" href="/">
            E-Clinical Case Solutions
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium sm:justify-center">
            <Link className="text-brand-teal" href="/student">
              Dashboard
            </Link>
            <Link
              className="hidden transition hover:text-brand-teal sm:inline"
              href="/student"
            >
              Certificates
            </Link>
          </div>
          <div className="flex sm:justify-end">
            <LogoutButton />
          </div>
        </nav>
      </header>
      {children}
    </main>
  );
}
