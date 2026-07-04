export const COGNITO_GROUPS = {
	student: "student"
} as const;

export type CognitoGroupName =
	(typeof COGNITO_GROUPS)[keyof typeof COGNITO_GROUPS];

export function hasStudentCognitoGroup(groups: readonly string[]) {
	return groups.includes(COGNITO_GROUPS.student);
}

export function isKnownCognitoGroup(group: unknown): group is CognitoGroupName {
	return Object.values(COGNITO_GROUPS).includes(group as CognitoGroupName);
}
