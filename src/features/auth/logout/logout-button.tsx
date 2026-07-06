"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/components/ui/notifications";

export function LogoutButton() {
	const router = useRouter();
	const { dismissByKey, notify } = useNotifications();
	const [isPending, setIsPending] = useState(false);

	async function handleLogout() {
		setIsPending(true);
		dismissByKey("student-standalone-logout");

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
				testId: "student-logout-error",
				dedupeKey: "student-standalone-logout",
			});
			setIsPending(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			<Button
				data-testid="student-logout-button"
				disabled={isPending}
				onClick={handleLogout}
				type="button"
				variant="secondary"
			>
				{isPending ? "Signing out" : "Log out"}
			</Button>
		</div>
	);
}
