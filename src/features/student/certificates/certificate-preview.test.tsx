import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudentCertificatePreview } from "./certificate-preview";

describe("StudentCertificatePreview", () => {
	it("renders only the approved certificate-facing facts", () => {
		const markup = renderToStaticMarkup(
			<StudentCertificatePreview
				certificate={{
					certificateBranding: {
						organizationName: "E-Clinical Case Solutions",
						shortName: "ECCS",
					},
					caseTitle: "Acute endocrine case review",
					completedAt: Date.UTC(2026, 6, 31),
					studentDisplayName: "Jordan Adebayo",
				}}
			/>,
		);

		expect(markup).toContain("E-Clinical Case Solutions");
		expect(markup).toContain("Jordan Adebayo");
		expect(markup).toContain("Acute endocrine case review");
		expect(markup).toContain("Completed Jul 31, 2026");
		expect(markup).not.toContain("Certificate ID");
		expect(markup).not.toContain("Credits");
		expect(markup).not.toContain("Partner");
		expect(markup).not.toContain("Issuing");
	});
});
