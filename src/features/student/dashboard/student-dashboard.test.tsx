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
					description:
						"Learn how patients with a serious infection can be managed in outpatient settings.",
					title: "Acute endocrine case review",
					deadlineAt: now + 14 * 24 * 60 * 60 * 1000,
				}}
				recentCertificates={[
					{
						certificateBranding: {
							organizationName: "E-Clinical Case Solutions",
							shortName: "ECCS",
						},
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
		expect(markup).toContain("Ongoing Case Study");
		expect(markup).toContain("Acute endocrine case review");
		expect(markup).toContain(
			"Learn how patients with a serious infection can be managed in outpatient settings.",
		);
		expect(markup).toContain("Deadline:");
		expect(markup).toContain("View Case Study");
		expect(markup).toContain('href="/student/cases/active-case"');
		expect(markup).toContain("bg-primary-action");
		expect(markup).toContain(
			"border border-white bg-white !text-primary-action",
		);
		expect(markup).toContain("hover:bg-app-canvas");
		expect(markup).toContain("Respiratory complications review");
		expect(markup).toContain("Download");
		expect(markup.indexOf("Ongoing Case Study")).toBeLessThan(
			markup.indexOf("Recent certificates"),
		);
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
		expect(markup).toContain("No certificates yet");
	});
});
