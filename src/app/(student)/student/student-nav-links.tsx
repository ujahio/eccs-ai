"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type StudentNavItem = {
	href: string;
	label: string;
	testId: string;
	className?: string;
};

const navItems: StudentNavItem[] = [
	{ href: "/student", label: "Dashboard", testId: "student-dashboard-link" },
	{
		href: "/student/certificates",
		label: "Certificates",
		testId: "student-certificates-link",
		className: "hidden sm:inline",
	},
];

export function StudentNavLinks() {
	const pathname = usePathname();

	return (
		<div className="hidden items-center gap-6 text-sm font-medium sm:flex sm:justify-center">
			{navItems.map((item) => {
				const isActive = pathname === item.href;

				return (
					<Link
						aria-current={isActive ? "page" : undefined}
						className={
							[
								item.className,
								isActive
									? "text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal"
									: "transition hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal",
							]
								.filter(Boolean)
								.join(" ")
						}
						data-testid={item.testId}
						href={item.href}
						key={item.testId}
					>
						{item.label}
					</Link>
				);
			})}
		</div>
	);
}
