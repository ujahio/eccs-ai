import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DemoCaseLifecycleConflictError,
	DemoTeacherCaseNotFoundError,
} from "@/features/teacher/cases/demo-case-lifecycle";

const mocks = vi.hoisted(() => ({
	requireTeacherSession: vi.fn(async () => ({
		profile: { profileId: "teacher-1" },
	})),
	setLifecycle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("sst", () => ({ Resource: {} }));

vi.mock("@/features/teacher/cases/demo-case-lifecycle", async () => {
	const actual = await vi.importActual<
		typeof import("@/features/teacher/cases/demo-case-lifecycle")
	>("@/features/teacher/cases/demo-case-lifecycle");

	return {
		...actual,
		getTeacherCaseDemoLifecycleService: () => ({
			setLifecycle: mocks.setLifecycle,
		}),
	};
});

vi.mock("@/lib/auth/session", () => ({
	requireTeacherSession: mocks.requireTeacherSession,
}));

let PATCH: typeof import("./route").PATCH;

beforeAll(async () => {
	({ PATCH } = await import("./route"));
});

beforeEach(() => {
	vi.unstubAllEnvs();
	vi.stubEnv("CASE_LIFECYCLE_DEMO_CONTROLS_ENABLED", "true");
	mocks.requireTeacherSession.mockClear();
	mocks.setLifecycle.mockReset();
});

describe("teacher demo case lifecycle route", () => {
	it("fails closed when the demo flag is not enabled", async () => {
		vi.stubEnv("CASE_LIFECYCLE_DEMO_CONTROLS_ENABLED", "");

		const response = await PATCH(
			new Request("http://localhost/api/teacher/demo-case-lifecycle", {
				body: JSON.stringify({
					caseId: "case-1",
					lifecycle: "archived",
				}),
				headers: { "content-type": "application/json" },
				method: "PATCH",
			}),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Not found." });
		expect(mocks.requireTeacherSession).not.toHaveBeenCalled();
		expect(mocks.setLifecycle).not.toHaveBeenCalled();
	});

	it("requires a case id and supported lifecycle", async () => {
		const response = await PATCH(
			new Request("http://localhost/api/teacher/demo-case-lifecycle", {
				body: JSON.stringify({
					caseId: "case-1",
					lifecycle: "draft",
				}),
				headers: { "content-type": "application/json" },
				method: "PATCH",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Provide a caseId and lifecycle of either published or archived.",
		});
		expect(mocks.requireTeacherSession).toHaveBeenCalledTimes(1);
		expect(mocks.setLifecycle).not.toHaveBeenCalled();
	});

	it("sets the requested lifecycle for the teacher case", async () => {
		mocks.setLifecycle.mockResolvedValue({
			archivedCaseIds: ["previous-active-case"],
			case: {
				caseId: "archived-case",
				completionCount: 0,
				deadlineAt: 1_779_388_800_000,
				feedbackCount: 0,
				lifecycle: "published",
				publishedAt: 1_778_179_200_000,
				title: "Archived case",
			},
			changed: true,
		});

		const response = await PATCH(
			new Request("http://localhost/api/teacher/demo-case-lifecycle", {
				body: JSON.stringify({
					caseId: " archived-case ",
					lifecycle: "published",
				}),
				headers: { "content-type": "application/json" },
				method: "PATCH",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			archivedCaseIds: ["previous-active-case"],
			case: {
				caseId: "archived-case",
				completionCount: 0,
				deadlineAt: 1_779_388_800_000,
				feedbackCount: 0,
				lifecycle: "published",
				publishedAt: 1_778_179_200_000,
				title: "Archived case",
			},
			changed: true,
		});
		expect(mocks.setLifecycle).toHaveBeenCalledWith({
			caseId: "archived-case",
			lifecycle: "published",
			now: expect.any(Number),
			teacherProfileId: "teacher-1",
		});
	});

	it("returns not found when the service cannot toggle the case", async () => {
		mocks.setLifecycle.mockRejectedValue(new DemoTeacherCaseNotFoundError());

		const response = await PATCH(
			new Request("http://localhost/api/teacher/demo-case-lifecycle", {
				body: JSON.stringify({
					caseId: "missing-case",
					lifecycle: "archived",
				}),
				headers: { "content-type": "application/json" },
				method: "PATCH",
			}),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Case not found." });
	});

	it("returns conflict when lifecycle state changes during the toggle", async () => {
		mocks.setLifecycle.mockRejectedValue(new DemoCaseLifecycleConflictError());

		const response = await PATCH(
			new Request("http://localhost/api/teacher/demo-case-lifecycle", {
				body: JSON.stringify({
					caseId: "case-1",
					lifecycle: "published",
				}),
				headers: { "content-type": "application/json" },
				method: "PATCH",
			}),
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: "Case lifecycle changed. Refresh and try again.",
		});
	});
});
