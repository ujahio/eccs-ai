import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetE2EAuthStore,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

vi.mock("server-only", () => ({}));

let InMemoryTeacherCaseLibraryRepository: typeof import("./cases").InMemoryTeacherCaseLibraryRepository;
let areDemoCaseLifecycleControlsEnabled: typeof import("@/lib/env/demo-case-lifecycle-controls").areDemoCaseLifecycleControlsEnabled;

beforeAll(async () => {
	({ InMemoryTeacherCaseLibraryRepository } = await import("./cases"));
	({ areDemoCaseLifecycleControlsEnabled } = await import(
		"@/lib/env/demo-case-lifecycle-controls"
	));
});

beforeEach(() => {
	resetE2EAuthStore();
	vi.unstubAllEnvs();
});

describe("InMemoryTeacherCaseLibraryRepository", () => {
	it("lists archived and dynamically expired cases from newest to oldest", async () => {
		const now = Date.UTC(2026, 6, 7);
		seedE2ETeacherCases([
			{
				caseId: "active-case",
				title: "Active case",
				lifecycle: "published",
				publishedAt: now - 1_000,
				deadlineAt: now + 86_400_000,
				completionCount: 2,
				feedbackCount: 1,
			},
			{
				caseId: "archived-older",
				title: "Archived older",
				lifecycle: "archived",
				publishedAt: now - 259_200_000,
				deadlineAt: now - 172_800_000,
				archivedAt: now - 172_800_000,
				completionCount: 5,
				feedbackCount: 2,
			},
			{
				caseId: "expired-published",
				title: "Expired published",
				lifecycle: "published",
				publishedAt: now - 86_400_000,
				deadlineAt: now - 1_000,
				completionCount: 7,
				feedbackCount: 3,
			},
			{
				caseId: "archived-newer",
				title: "Archived newer",
				lifecycle: "archived",
				publishedAt: now - 172_800_000,
				deadlineAt: now - 86_400_000,
				archivedAt: now - 500,
				completionCount: 9,
				feedbackCount: 4,
			},
		]);
		const repository = new InMemoryTeacherCaseLibraryRepository();

		const archivedCases = await repository.listArchivedCases(now);

		expect(archivedCases.map((caseRecord) => caseRecord.caseId)).toEqual([
			"archived-newer",
			"expired-published",
			"archived-older",
		]);
		expect(archivedCases).toEqual([
			expect.objectContaining({
				caseId: "archived-newer",
				completionCount: 9,
				feedbackCount: 4,
			}),
			expect.objectContaining({
				caseId: "expired-published",
				completionCount: 7,
				feedbackCount: 3,
			}),
			expect.objectContaining({
				caseId: "archived-older",
				completionCount: 5,
				feedbackCount: 2,
			}),
		]);
		expect(archivedCases).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ caseId: "active-case" }),
			]),
		);
	});

	it("reads the demo lifecycle controls flag from server environment", () => {
		expect(areDemoCaseLifecycleControlsEnabled()).toBe(false);

		vi.stubEnv("CASE_LIFECYCLE_DEMO_CONTROLS_ENABLED", "enabled");

		expect(areDemoCaseLifecycleControlsEnabled()).toBe(true);
	});
});
