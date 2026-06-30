import type { ReactNode } from "react";
import Link from "next/link";

export default function StudentLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-app-canvas text-primary-text">
      <header className="border-b border-border-gray bg-white">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link className="text-base font-semibold" href="/">
            E-Clinical Case Solutions
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
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
        </nav>
      </header>
      {children}
    </main>
  );
}
