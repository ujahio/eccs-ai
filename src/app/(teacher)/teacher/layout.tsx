import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { requireTeacherSession } from "@/lib/auth/session";
import { TeacherAccountMenu } from "./teacher-account-menu";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({
	children
}: Readonly<{
	children: ReactNode;
}>) {
	const { profile } = await requireTeacherSession();

	return (
		<main className="min-h-screen bg-app-canvas text-primary-text">
			<header className="border-b border-border-gray bg-white">
				<nav className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:min-h-16 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6 sm:py-0">
					<Link href="/" aria-label="E-Clinical Case Solutions home">
						<Image
							alt="E-Clinical Case Solutions"
							className="h-7 w-auto"
							height={35}
							priority
							src="/images/logo.png"
							width={150}
						/>
					</Link>
					<div className="hidden items-center gap-6 text-sm font-medium sm:flex sm:justify-center">
						<Link
							className="text-brand-teal"
							data-testid="teacher-dashboard-link"
							href="/teacher"
						>
							Dashboard
						</Link>
						<Link
							className="transition hover:text-brand-teal"
							data-testid="teacher-cases-link"
							href="/teacher/cases"
						>
							Case Studies
						</Link>
					</div>
					<TeacherAccountMenu teacherName={profile.fullName} />
				</nav>
			</header>
			{children}
		</main>
	);
}
