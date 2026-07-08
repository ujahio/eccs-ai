export type TeacherCaseLifecycle = "published" | "archived" | "draft";

export type TeacherCaseLifecycleRecord = {
	archivedAt?: number;
	deadlineAt: number;
	lifecycle: TeacherCaseLifecycle;
};

export function isActiveTeacherCase(
	caseRecord: TeacherCaseLifecycleRecord,
	now: number,
) {
	return caseRecord.lifecycle === "published" && caseRecord.deadlineAt >= now;
}

export function isArchivedTeacherCase(
	caseRecord: TeacherCaseLifecycleRecord,
	now: number,
) {
	return (
		caseRecord.lifecycle === "archived" ||
		(caseRecord.lifecycle === "published" && caseRecord.deadlineAt < now)
	);
}

export function sortArchivedTeacherCases<T extends TeacherCaseLifecycleRecord>(
	cases: T[],
	now: number,
	limit?: number,
) {
	const sortedCases = cases
		.filter((caseRecord) => isArchivedTeacherCase(caseRecord, now))
		.sort(
			(first, second) =>
				archivedAtTeacherCase(second, now) - archivedAtTeacherCase(first, now),
		);

	return typeof limit === "number" ? sortedCases.slice(0, limit) : sortedCases;
}

export function archivedAtTeacherCase(
	caseRecord: TeacherCaseLifecycleRecord,
	now: number,
) {
	return caseRecord.archivedAt ?? Math.min(caseRecord.deadlineAt, now);
}
