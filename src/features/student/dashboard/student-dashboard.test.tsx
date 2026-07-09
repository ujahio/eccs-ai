import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentDashboard } from "./student-dashboard";

describe("StudentDashboard", () => {
	it("renders personalized active case and recent certificate states", () => {
		const now = Date.UTC(2026, 6, 7);
		const markup = renderToStaticMarkup(
			<StudentDashboard
				activeCase={{
					caseId: "active-case",
					title: "Acute endocrine case review",
					deadlineAt: now + 14 * 24 * 60 * 60 * 1000,
				}}
				recentCertificates={[
					{
						certificateId: "certificate-1",
						caseId: "case-1",
						caseTitle: "Respiratory complications review",
						completedAt: now - 1_000,
						studentDisplayName: "Jordan Adebayo",
					},
				]}
				studentName="Jordan Adebayo"
			/>,
		);

		expect(markup).toContain("Welcome back, Jordan");
		expect(markup).toContain("Acute endocrine case review");
		expect(markup).toContain("Respiratory complications review");
		expect(markup).toContain("Download");
	});

	it("renders no-active-case and empty certificate states", () => {
		const markup = renderToStaticMarkup(
			<StudentDashboard
				activeCase={null}
				recentCertificates={[]}
				studentName="Jordan Adebayo"
			/>,
		);

		expect(markup).toContain("No active case available");
		expect(markup).toContain("Your account is active.");
		expect(markup).toContain("No certificates yet");
	});
});
