"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState("");

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

			router.replace("/login");
			router.refresh();
		} catch {
			setError("We could not sign you out. Please try again.");
			setIsPending(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			{error ? (
				<p
					className="hidden text-xs font-medium text-error-red sm:block"
					data-testid="student-logout-error"
					role="alert"
				>
					{error}
				</p>
			) : null}
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
