import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ActivePublishedCaseError,
	PublishArchiveSchedulingError,
	PublishDraftNotFoundError,
	PublishValidationError,
} from "@/features/teacher/case-authoring/publishing";

const mocks = vi.hoisted(() => ({
	sendNewCasePublishedEmail: vi.fn(),
	publishDraft: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("sst", () => ({ Resource: {} }));

vi.mock("@/features/teacher/case-authoring/publishing", async () => {
	const actual = await vi.importActual<
		typeof import("@/features/teacher/case-authoring/publishing")
	>("@/features/teacher/case-authoring/publishing");

	return {
		...actual,
		getTeacherCasePublisher: () => mocks,
	};
});

vi.mock("@/features/case-notifications/server", () => ({
	getCaseLifecycleNotificationService: () => ({
		sendNewCasePublishedEmail: mocks.sendNewCasePublishedEmail,
	}),
}));

vi.mock("@/lib/auth/session", () => ({
	requireTeacherSession: vi.fn(async () => ({
		profile: { profileId: "teacher-1" },
	})),
}));

let POST: typeof import("./route").POST;

beforeAll(async () => {
	({ POST } = await import("./route"));
});

beforeEach(() => {
	mocks.publishDraft.mockReset();
	mocks.sendNewCasePublishedEmail.mockReset();
});

describe("teacher case publish route", () => {
	it("publishes a case draft snapshot", async () => {
		mocks.publishDraft.mockResolvedValue({
			caseId: "case-1",
			deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
			publishedAt: Date.UTC(2026, 6, 7),
			title: "Acute endocrine review",
		});

		const response = await POST(
			new Request("http://localhost/api/teacher/case-publish", {
				body: JSON.stringify({
					caseId: "case-1",
					draft: { title: "Acute endocrine review" },
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			case: {
				caseId: "case-1",
				deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
				publishedAt: Date.UTC(2026, 6, 7),
				title: "Acute endocrine review",
			},
		});
		expect(mocks.publishDraft).toHaveBeenCalledWith(
			expect.objectContaining({
				caseId: "case-1",
				draft: expect.objectContaining({ title: "Acute endocrine review" }),
				teacherProfileId: "teacher-1",
			}),
		);
		expect(mocks.sendNewCasePublishedEmail).toHaveBeenCalledWith({
			caseId: "case-1",
			deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
			publishedAt: Date.UTC(2026, 6, 7),
			title: "Acute endocrine review",
		});
	});

	it("returns unavailable when archive scheduling fails during publish", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.publishDraft.mockRejectedValue(
			new PublishArchiveSchedulingError({
				cause: new Error("scheduler unavailable"),
			}),
		);

		const response = await POST(
			new Request("http://localhost/api/teacher/case-publish", {
				body: JSON.stringify({
					caseId: "case-1",
					draft: { title: "Acute endocrine review" },
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error:
				"Publishing is temporarily unavailable because archive scheduling failed.",
		});
		expect(errorSpy).toHaveBeenCalledWith(
			"Case archive scheduling failed",
			expect.any(PublishArchiveSchedulingError),
		);
		expect(mocks.sendNewCasePublishedEmail).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("keeps publish successful when new-case email delivery fails", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		mocks.publishDraft.mockResolvedValue({
			caseId: "case-1",
			deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
			publishedAt: Date.UTC(2026, 6, 7),
			title: "Acute endocrine review",
		});
		mocks.sendNewCasePublishedEmail.mockRejectedValue(
			new Error("email provider unavailable"),
		);

		const response = await POST(
			new Request("http://localhost/api/teacher/case-publish", {
				body: JSON.stringify({
					caseId: "case-1",
					draft: { title: "Acute endocrine review" },
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			case: {
				caseId: "case-1",
				deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
				publishedAt: Date.UTC(2026, 6, 7),
				title: "Acute endocrine review",
			},
		});
		expect(warnSpy).toHaveBeenCalledWith(
			"Case publication notification email failed",
			expect.any(Error),
		);
		expect((warnSpy.mock.calls[0]?.[1] as Error).message).toBe(
			"email provider unavailable",
		);
		warnSpy.mockRestore();
	});

	it("returns validation errors for incomplete publish content", async () => {
		mocks.publishDraft.mockRejectedValue(
			new PublishValidationError({ deadlineDate: "Select the student deadline date." }),
		);

		const response = await POST(
			new Request("http://localhost/api/teacher/case-publish", {
				body: JSON.stringify({ draft: {} }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			validation: {
				deadlineDate: "Select the student deadline date.",
			},
		});
	});

	it("returns conflict while another published case is still active", async () => {
		mocks.publishDraft.mockRejectedValue(new ActivePublishedCaseError());

		const response = await POST(
			new Request("http://localhost/api/teacher/case-publish", {
				body: JSON.stringify({ draft: {} }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: "Publishing is unavailable while another case is active.",
		});
	});

	it("returns not found when the draft id is no longer editable", async () => {
		mocks.publishDraft.mockRejectedValue(new PublishDraftNotFoundError());

		const response = await POST(
			new Request("http://localhost/api/teacher/case-publish", {
				body: JSON.stringify({ caseId: "missing", draft: {} }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Draft not found." });
	});
});
