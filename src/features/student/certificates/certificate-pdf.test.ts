import { describe, expect, it } from "vitest";
import { certificatePdfBytes, safeCertificateFilename } from "./certificate-pdf";

describe("certificatePdfBytes", () => {
	it("creates a landscape certificate PDF with approved facts only", () => {
		const bytes = certificatePdfBytes({
			certificateBranding: {
				organizationName: "E-Clinical Case Solutions",
			},
			caseTitle: "The case for dracula and its minions at 75 days",
			completedAt: Date.UTC(2026, 6, 12),
			studentDisplayName: "James Dean",
		});
		const pdf = new TextDecoder().decode(bytes);

		expect(pdf).toContain("%PDF-1.4");
		expect(pdf).toContain("/MediaBox [0 0 792 612]");
		expect(pdf).toContain("E-Clinical Case Solutions");
		expect(pdf).toContain("Certificate Of Completion");
		expect(pdf).toContain("James Dean");
		expect(pdf).toContain("The case for dracula and its minions at 75 days");
		expect(pdf).toContain("Completed Jul 12, 2026");
		expect(pdf).not.toContain("Certificate ID");
		expect(pdf).not.toContain("Credits");
		expect(pdf).not.toContain("Partner");
		expect(pdf).not.toContain("Issuing");
	});
});

describe("safeCertificateFilename", () => {
	it("builds a stable certificate download filename", () => {
		expect(
			safeCertificateFilename("The case for dracula and its minions at 75 days"),
		).toBe("certificate-the-case-for-dracula-and-its-minions-at-75-days");
	});
});
