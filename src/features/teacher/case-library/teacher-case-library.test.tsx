import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { patchTeacherCaseLifecycle } from "@/features/teacher/cases/demo-case-lifecycle-client";
import { TeacherCaseLibrary } from "./teacher-case-library";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: vi.fn(),
	}),
}));

const now = Date.UTC(2026, 6, 7);

describe("TeacherCaseLibrary", () => {
	it("hides lifecycle controls when demo controls are disabled", () => {
		const markup = renderToStaticMarkup(
			<TeacherCaseLibrary
				archivedCases={[
					{
						caseId: "archived-case",
						title: "Archived case",
						publishedAt: now - 20,
						deadlineAt: now - 10,
						archivedAt: now - 10,
						completionCount: 2,
						feedbackCount: 1,
					},
				]}
				demoControlsEnabled={false}
				draftCases={[]}
			/>,
		);

		expect(markup).not.toContain("Published");
		expect(markup).not.toContain("teacher-case-library-published-mode");
		expect(markup).not.toContain("teacher-case-lifecycle-toggle");
		expect(markup).toContain("Archived case");
	});

	it("keeps the case library limited to drafts and archived cases when demo controls are enabled", () => {
		const markup = renderToStaticMarkup(
			<TeacherCaseLibrary
				archivedCases={[]}
				demoControlsEnabled
				draftCases={[]}
			/>,
		);

		expect(markup).toContain('data-testid="teacher-case-library-draft-mode"');
		expect(markup).toContain('data-testid="teacher-case-library-archived-mode"');
		expect(markup).not.toContain("teacher-case-library-published-mode");
		expect(markup).not.toContain("teacher-library-published-cases");
	});

	it("adds restore toggles to archived case cards without adding them to drafts", () => {
		const archivedMarkup = renderToStaticMarkup(
			<TeacherCaseLibrary
				archivedCases={[
					{
						caseId: "archived-case",
						title: "Archived case",
						publishedAt: now - 20,
						deadlineAt: now - 10,
						archivedAt: now - 10,
						completionCount: 2,
						feedbackCount: 1,
					},
				]}
				demoControlsEnabled
				draftCases={[]}
			/>,
		);
		const draftMarkup = renderToStaticMarkup(
			<TeacherCaseLibrary
				archivedCases={[]}
				demoControlsEnabled
				draftCases={[
					{
						attachmentCount: 1,
						caseId: "draft-case",
						deadlineDate: "2026-07-21",
						description: "Draft description",
						title: "Draft case",
						updatedAt: now,
					},
				]}
			/>,
		);

		expect(archivedMarkup).toContain(
			'data-testid="teacher-case-lifecycle-toggle-archived-case"',
		);
		expect(draftMarkup).toContain("Draft case");
		expect(draftMarkup).not.toContain("teacher-case-lifecycle-toggle");
	});
});

describe("patchTeacherCaseLifecycle", () => {
	it("patches the lifecycle override endpoint with the selected case lifecycle", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
		})) as unknown as typeof fetch;

		await patchTeacherCaseLifecycle(fetchMock, {
			caseId: "archived-case",
			lifecycle: "published",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/teacher/demo-case-lifecycle",
			{
				body: JSON.stringify({
					caseId: "archived-case",
					lifecycle: "published",
				}),
				headers: {
					"Content-Type": "application/json",
				},
				method: "PATCH",
			},
		);
	});

	it("throws when the lifecycle override endpoint rejects the update", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: false,
		})) as unknown as typeof fetch;

		await expect(
			patchTeacherCaseLifecycle(fetchMock, {
				caseId: "published-case",
				lifecycle: "archived",
			}),
		).rejects.toThrow("Case lifecycle update failed.");
	});
});
