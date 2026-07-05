"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type StudentAccountMenuProps = {
	studentName: string;
};

export function StudentAccountMenu({ studentName }: StudentAccountMenuProps) {
	const router = useRouter();
	const menuRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		function handlePointerDown(event: PointerEvent) {
			if (
				menuRef.current &&
				!menuRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setIsOpen(false);
			}
		}

		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	async function handleLogout() {
		setIsPending(true);
		setError("");

		try {
			const response = await fetch("/api/auth/sign-out", {
				method: "POST",
				credentials: "same-origin",
				headers: {
					accept: "application/json",
					"content-type": "application/json",
				},
				body: JSON.stringify({}),
			});

			if (!response.ok) {
				throw new Error("Sign out failed.");
			}

			setIsOpen(false);
			router.replace("/login");
			router.refresh();
		} catch {
			setError("We could not sign you out. Please try again.");
			setIsPending(false);
		}
	}

	function closeMenu() {
		setIsOpen(false);
	}

	const menuLinkClasses =
		"block px-4 py-3 text-sm font-medium text-primary-text transition hover:bg-app-canvas hover:text-brand-teal";

	return (
		<div className="relative flex justify-start sm:justify-end" ref={menuRef}>
			<button
				aria-controls="student-account-menu"
				aria-expanded={isOpen}
				aria-haspopup="menu"
				aria-label={`Open menu for ${studentName}`}
				className="inline-flex h-11 w-11 items-center justify-center rounded border border-border-gray bg-white text-primary-text transition hover:border-primary-action hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal sm:w-auto sm:max-w-[16rem] sm:justify-start sm:gap-2 sm:border-0 sm:bg-transparent sm:text-sm sm:font-semibold"
				data-testid="student-account-menu-trigger"
				onClick={() => setIsOpen((open) => !open)}
				type="button"
			>
				<span className="grid gap-1 sm:hidden" aria-hidden="true">
					<span className="h-0.5 w-5 bg-current" />
					<span className="h-0.5 w-5 bg-current" />
					<span className="h-0.5 w-5 bg-current" />
				</span>
				<span className="hidden min-w-0 truncate sm:inline">
					{studentName}
				</span>
				<span
					aria-hidden="true"
					className="hidden h-2 w-2 shrink-0 rotate-45 border-b border-r border-current sm:inline-block"
				/>
			</button>

			{isOpen ? (
				<div
					className="absolute right-0 top-12 z-20 w-64 border border-border-gray bg-white py-2 shadow-soft sm:w-56"
					data-testid="student-account-menu"
					id="student-account-menu"
					role="menu"
				>
					<Link
						className={`${menuLinkClasses} sm:hidden`}
						data-testid="student-account-menu-dashboard"
						href="/student"
						onClick={closeMenu}
						role="menuitem"
					>
						Dashboard
					</Link>
					<Link
						className={`${menuLinkClasses} sm:hidden`}
						data-testid="student-account-menu-certificates"
						href="/student"
						onClick={closeMenu}
						role="menuitem"
					>
						Certificates
					</Link>
					<Link
						className={menuLinkClasses}
						data-testid="student-account-menu-profile"
						href="/student/profile"
						onClick={closeMenu}
						role="menuitem"
					>
						Profile
					</Link>
					<Link
						className={`${menuLinkClasses} hidden sm:block`}
						data-testid="student-account-menu-cases"
						href="/student"
						onClick={closeMenu}
						role="menuitem"
					>
						Case studies
					</Link>
					<button
						className="block w-full px-4 py-3 text-left text-sm font-medium text-primary-text transition hover:bg-app-canvas hover:text-brand-teal disabled:pointer-events-none disabled:opacity-60"
						data-testid="student-logout-button"
						disabled={isPending}
						onClick={handleLogout}
						role="menuitem"
						type="button"
					>
						{isPending ? "Signing out" : "Sign out"}
					</button>
					{error ? (
						<p
							className="border-t border-border-gray px-4 pt-3 text-xs font-medium leading-5 text-error-red"
							data-testid="student-logout-error"
							role="alert"
						>
							{error}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
