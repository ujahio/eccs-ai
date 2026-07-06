import type { AppRole } from "./roles";

export const COGNITO_GROUPS = {
	student: "student",
	teacher: "teacher"
} as const;

export type CognitoGroupName =
	(typeof COGNITO_GROUPS)[keyof typeof COGNITO_GROUPS];

export function hasStudentCognitoGroup(groups: readonly string[]) {
	return groups.includes(COGNITO_GROUPS.student);
}

export function hasTeacherCognitoGroup(groups: readonly string[]) {
	return groups.includes(COGNITO_GROUPS.teacher);
}

export function hasCognitoGroupForRole(
	groups: readonly string[],
	role: AppRole
) {
	return groups.includes(COGNITO_GROUPS[role]);
}

export function roleFromCognitoGroups(groups: readonly string[]) {
	const roles = Object.entries(COGNITO_GROUPS)
		.filter(([, group]) => groups.includes(group))
		.map(([role]) => role as AppRole);

	return roles.length === 1 ? roles[0] : null;
}

export function isKnownCognitoGroup(group: unknown): group is CognitoGroupName {
	return Object.values(COGNITO_GROUPS).includes(group as CognitoGroupName);
}
