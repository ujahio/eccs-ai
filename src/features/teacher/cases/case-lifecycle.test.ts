import { describe, expect, it } from "vitest";
import {
	archivedAtTeacherCase,
	isActiveTeacherCase,
	isArchivedTeacherCase,
} from "./case-lifecycle";

describe("teacher case lifecycle", () => {
	it("treats a published case as active through its deadline cutoff", () => {
		const deadlineAt = Date.UTC(2026, 7, 12, 19, 59, 59, 999);
		const caseRecord = {
			lifecycle: "published" as const,
			deadlineAt,
		};

		expect(isActiveTeacherCase(caseRecord, deadlineAt)).toBe(true);
		expect(isArchivedTeacherCase(caseRecord, deadlineAt)).toBe(false);
		expect(isActiveTeacherCase(caseRecord, deadlineAt + 1)).toBe(false);
		expect(isArchivedTeacherCase(caseRecord, deadlineAt + 1)).toBe(true);
	});

	it("uses persisted archive time when available and deadline time otherwise", () => {
		const now = Date.UTC(2026, 7, 13);
		const deadlineAt = Date.UTC(2026, 7, 12, 19, 59, 59, 999);

		expect(
			archivedAtTeacherCase(
				{
					lifecycle: "published",
					deadlineAt,
				},
				now,
			),
		).toBe(deadlineAt);
		expect(
			archivedAtTeacherCase(
				{
					lifecycle: "archived",
					deadlineAt,
					archivedAt: now,
				},
				now,
			),
		).toBe(now);
	});
});
