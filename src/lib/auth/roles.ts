export const APP_ROLES = ["student", "teacher"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type RoleRedirectPath = "/student" | "/teacher";

export function isAppRole(role: unknown): role is AppRole {
	return typeof role === "string" && APP_ROLES.includes(role as AppRole);
}

export function redirectPathForRole(role: AppRole): RoleRedirectPath {
	return role === "teacher" ? "/teacher" : "/student";
}
