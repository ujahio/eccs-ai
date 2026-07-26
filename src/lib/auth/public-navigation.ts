import { redirectPathForRole, type AppRole } from "@/lib/auth/roles";

export function publicDashboardActionForRole(role: AppRole) {
	return {
		href: redirectPathForRole(role),
		label: role === "student" ? "Continue Learning" : "Teacher Dashboard",
	};
}

export function publicLandingActionForRole(role: AppRole | undefined) {
	if (!role) {
		return {
			href: "/register" as const,
			label: "Get started",
		};
	}

	return publicDashboardActionForRole(role);
}
