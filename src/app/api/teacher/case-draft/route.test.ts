import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	deleteDraft: vi.fn(),
	getDraft: vi.fn(),
	listDrafts: vi.fn(),
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

let DELETE: typeof import("./route").DELETE;
let GET: typeof import("./route").GET;
let PUT: typeof import("./route").PUT;

beforeAll(async () => {
	({ DELETE, GET, PUT } = await import("./route"));
});

beforeEach(() => {
	mocks.deleteDraft.mockReset();
	mocks.getDraft.mockReset();
	mocks.listDrafts.mockReset();
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
		const savedDraft = { caseId: "case-1", title: "Acute endocrine review" };
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
				caseId: "case-1",
				draft: expect.objectContaining({ title: "Acute endocrine review" }),
				teacherProfileId: "teacher-1",
			}),
		);
	});

	it("lists teacher draft records when no case id is requested", async () => {
		const draft = { caseId: "case-1", title: "Acute endocrine review" };
		const drafts = [
			{
				attachmentCount: 1,
				caseId: "case-1",
				title: "Acute endocrine review",
				updatedAt: 1_800_000_000,
			},
		];
		mocks.getDraft.mockResolvedValue(draft);
		mocks.listDrafts.mockResolvedValue(drafts);

		const response = await GET(
			new Request("http://localhost/api/teacher/case-draft"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ draft, drafts });
		expect(mocks.listDrafts).toHaveBeenCalledWith("teacher-1");
		expect(mocks.getDraft).toHaveBeenCalledWith("teacher-1");
	});

	it("loads a specific teacher draft by case id", async () => {
		const draft = { caseId: "case-1", title: "Acute endocrine review" };
		mocks.getDraft.mockResolvedValue(draft);

		const response = await GET(
			new Request("http://localhost/api/teacher/case-draft?caseId=case-1"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ draft });
		expect(mocks.getDraft).toHaveBeenCalledWith("teacher-1", "case-1");
		expect(mocks.listDrafts).not.toHaveBeenCalled();
	});

	it("returns not found when a specific draft does not exist", async () => {
		mocks.getDraft.mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost/api/teacher/case-draft?caseId=missing"),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Draft not found." });
		expect(mocks.getDraft).toHaveBeenCalledWith("teacher-1", "missing");
	});

	it("requires a case id before deleting a draft", async () => {
		const response = await DELETE(
			new Request("http://localhost/api/teacher/case-draft", {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "caseId is required to delete a draft.",
		});
		expect(mocks.deleteDraft).not.toHaveBeenCalled();
	});

	it("deletes a specific draft and returns the removed attachment count", async () => {
		mocks.deleteDraft.mockResolvedValue({
			attachmentCount: 1,
			caseId: "case-1",
		});

		const response = await DELETE(
			new Request("http://localhost/api/teacher/case-draft?caseId=case-1", {
				method: "DELETE",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			attachmentCount: 1,
			caseId: "case-1",
		});
		expect(mocks.deleteDraft).toHaveBeenCalledWith({
			caseId: "case-1",
			teacherProfileId: "teacher-1",
		});
	});
});
