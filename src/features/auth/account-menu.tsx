"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotifications } from "@/components/ui/notifications";

type AccountMenuItem = {
	href: string;
	label: string;
	testId: string;
	className?: string;
};

type AccountMenuProps = {
	items: AccountMenuItem[];
	menuId: string;
	menuTestId: string;
	name: string;
	triggerTestId: string;
	logoutButtonTestId: string;
	logoutErrorTestId: string;
};

const triggerClasses =
	"inline-flex h-11 w-11 items-center justify-center rounded border border-border-gray bg-white text-primary-text transition hover:border-primary-action hover:text-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal sm:w-auto sm:max-w-[16rem] sm:justify-start sm:gap-2 sm:border-0 sm:bg-transparent sm:text-sm sm:font-semibold";

const itemClasses =
	"flex min-h-11 w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm font-medium leading-5 text-primary-text outline-none transition hover:bg-app-canvas hover:text-brand-teal focus:bg-app-canvas focus:text-brand-teal data-[disabled]:pointer-events-none data-[disabled]:opacity-60 data-[highlighted]:bg-app-canvas data-[highlighted]:text-brand-teal";

export function AccountMenu({
	items,
	menuId,
	menuTestId,
	name,
	triggerTestId,
	logoutButtonTestId,
	logoutErrorTestId,
}: AccountMenuProps) {
	const router = useRouter();
	const { dismissByKey, notify } = useNotifications();
	const [isPending, setIsPending] = useState(false);
	const logoutNotificationKey = `${menuId}-logout`;

	async function handleLogout() {
		if (isPending) {
			return;
		}

		setIsPending(true);
		dismissByKey(logoutNotificationKey);

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

			router.replace("/login");
			router.refresh();
		} catch {
			notify({
				tone: "error",
				message: "We could not sign you out. Please try again.",
				testId: logoutErrorTestId,
				dedupeKey: logoutNotificationKey,
			});
			setIsPending(false);
		}
	}

	return (
		<div className="flex justify-start sm:justify-end">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger asChild>
					<button
						aria-label={`Open menu for ${name}`}
						className={triggerClasses}
						data-testid={triggerTestId}
						type="button"
					>
						<span className="grid gap-1 sm:hidden" aria-hidden="true">
							<span className="h-0.5 w-5 bg-current" />
							<span className="h-0.5 w-5 bg-current" />
							<span className="h-0.5 w-5 bg-current" />
						</span>
						<span className="hidden min-w-0 truncate leading-none sm:inline">
							{name}
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
					</button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						align="end"
						className="z-50 w-64 border border-border-gray bg-white py-2 shadow-soft outline-none sm:w-56"
						data-testid={menuTestId}
						id={menuId}
						sideOffset={8}
					>
						{items.map((item) => (
							<DropdownMenu.Item asChild key={item.testId}>
								<Link
									className={`${itemClasses} ${item.className ?? ""}`}
									data-testid={item.testId}
									href={item.href}
								>
									{item.label}
								</Link>
							</DropdownMenu.Item>
						))}
						<DropdownMenu.Item
							className={itemClasses}
							data-testid={logoutButtonTestId}
							disabled={isPending}
							onSelect={(event) => {
								event.preventDefault();
								void handleLogout();
							}}
						>
							{isPending ? "Signing out" : "Sign out"}
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</div>
	);
}
