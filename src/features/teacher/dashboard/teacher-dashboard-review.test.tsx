import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TeacherDashboardReview } from "./teacher-dashboard-review";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: vi.fn(),
	}),
}));

describe("TeacherDashboardReview", () => {
	it("renders active and archived teacher case summaries", () => {
		const now = Date.UTC(2026, 6, 7);
		const markup = renderToStaticMarkup(
			<TeacherDashboardReview
				activeCase={{
					caseId: "active-case",
					title: "Acute endocrine case review",
					publishedAt: now,
					deadlineAt: now + 14 * 24 * 60 * 60 * 1000,
					completionCount: 12,
					feedbackCount: 5,
				}}
				archivedCases={[
					{
						caseId: "archived-case",
						title: "Respiratory complications review",
						publishedAt: now - 20,
						deadlineAt: now - 10,
						archivedAt: now - 10,
						completionCount: 8,
						feedbackCount: 3,
					},
				]}
				demoControlsEnabled={false}
			/>,
		);

		expect(markup).toContain("Start a draft case");
		expect(markup).toContain("Acute endocrine case review");
		expect(markup).toContain("Respiratory complications review");
		expect(markup).toContain('data-testid="teacher-active-case-card"');
		expect(markup).not.toContain(
			"teacher-dashboard-active-case-lifecycle-toggle",
		);
	});

	it("renders the active case archive toggle on the dashboard when demo controls are enabled", () => {
		const now = Date.UTC(2026, 6, 7);
		const markup = renderToStaticMarkup(
			<TeacherDashboardReview
				activeCase={{
					caseId: "active-case",
					title: "Acute endocrine case review",
					publishedAt: now,
					deadlineAt: now + 14 * 24 * 60 * 60 * 1000,
					completionCount: 12,
					feedbackCount: 5,
				}}
				archivedCases={[]}
				demoControlsEnabled
			/>,
		);

		expect(markup).toContain(
			'data-testid="teacher-dashboard-active-case-lifecycle-toggle"',
		);
		expect(markup).not.toContain("Case status");
		expect(markup).not.toContain("Available to students");
	});

	it("renders empty states without an active case", () => {
		const markup = renderToStaticMarkup(
			<TeacherDashboardReview
				activeCase={null}
				archivedCases={[]}
				demoControlsEnabled
			/>,
		);

		expect(markup).toContain("Start a New Case");
		expect(markup).toContain("No active case");
		expect(markup).toContain("No archived cases");
		expect(markup).not.toContain(
			"teacher-dashboard-active-case-lifecycle-toggle",
		);
	});
});
