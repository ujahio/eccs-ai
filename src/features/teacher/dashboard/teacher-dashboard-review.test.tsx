import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeacherDashboardReview } from "./teacher-dashboard-review";

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
			/>,
		);

		expect(markup).toContain("Start a draft case");
		expect(markup).toContain("Acute endocrine case review");
		expect(markup).toContain("Respiratory complications review");
		expect(markup).toContain('data-testid="teacher-active-case-card"');
	});

	it("renders empty states without an active case", () => {
		const markup = renderToStaticMarkup(
			<TeacherDashboardReview activeCase={null} archivedCases={[]} />,
		);

		expect(markup).toContain("Start a New Case");
		expect(markup).toContain("No active case");
		expect(markup).toContain("No archived cases");
	});
});
