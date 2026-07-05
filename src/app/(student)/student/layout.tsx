import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { StudentAccountMenu } from "./student-account-menu";
import { StudentNavLinks } from "./student-nav-links";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const { profile } = await requireStudentSession();

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
					<StudentNavLinks />
					<StudentAccountMenu studentName={profile.fullName} />
				</nav>
			</header>
			{children}
		</main>
	);
}
