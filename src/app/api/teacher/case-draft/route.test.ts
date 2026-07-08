import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getDraft: vi.fn(),
	saveDraft: vi.fn(),
}));

vi.mock("@/features/teacher/case-authoring/drafts", () => ({
	getTeacherCaseDraftRepository: () => mocks,
}));

vi.mock("@/lib/auth/session", () => ({
	requireTeacherSession: vi.fn(async () => ({
		profile: { profileId: "teacher-1" },
	})),
}));

let PUT: typeof import("./route").PUT;

beforeAll(async () => {
	({ PUT } = await import("./route"));
});

beforeEach(() => {
	mocks.getDraft.mockReset();
	mocks.saveDraft.mockReset();
});

describe("teacher case draft route", () => {
	it("does not persist a draft record without a Case Title", async () => {
		const response = await PUT(
			new Request("http://localhost/api/teacher/case-draft", {
				body: JSON.stringify({ draft: { title: "" } }),
				headers: { "content-type": "application/json" },
				method: "PUT",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			validation: {
				title: "Enter a Case Title before saving this draft.",
			},
		});
		expect(mocks.saveDraft).not.toHaveBeenCalled();
	});

	it("persists a draft record once a Case Title exists", async () => {
		const savedDraft = { title: "Acute endocrine review" };
		mocks.saveDraft.mockResolvedValue(savedDraft);

		const response = await PUT(
			new Request("http://localhost/api/teacher/case-draft", {
				body: JSON.stringify({ draft: savedDraft }),
				headers: { "content-type": "application/json" },
				method: "PUT",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ draft: savedDraft });
		expect(mocks.saveDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				draft: expect.objectContaining({ title: "Acute endocrine review" }),
				teacherProfileId: "teacher-1",
			}),
		);
	});
});
