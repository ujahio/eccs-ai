import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { formatDubaiDate } from "@/lib/date-format";

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const password = "Casework1!";
const certificateBranding = {
	organizationName: "E-Clinical Case Solutions",
	shortName: "ECCS",
};

function uniqueEmail(prefix: string) {
	return `e2e-${prefix}-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}@example.com`;
}

function e2eStudentProfileId(email: string) {
	return `e2e-sub-${email.toLowerCase().trim()}`;
}

async function bootstrapVerifiedStudent(
	request: APIRequestContext,
	email: string,
) {
	const response = await request.post("/api/e2e/auth/state", {
		data: {
			action: "bootstrap_student",
			email,
			firstName: "Jordan",
			lastName: "Adebayo",
			password,
			emailVerified: true,
		},
	});

	expect(response.ok()).toBe(true);
}

async function loginStudent(page: Page, email: string) {
	await page.goto("/login");
	await expect(page.getByTestId("login-form")).toHaveAttribute(
		"data-client-ready",
		"true",
	);
	await page.getByTestId("login-email").fill(email);
	await page.getByTestId("login-password").fill(password);
	await page.getByTestId("login-submit").click();
	await expect(page).toHaveURL(/\/student$/);
}

async function seedStudentDashboard(
	request: APIRequestContext,
	data: {
		activeCase: {
			caseId?: string;
			description?: string;
			title: string;
			publishedAt: number;
			deadlineAt: number;
		} | null;
		certificates?: Array<{
			certificateBranding: {
				organizationName: string;
				shortName: string;
			};
			certificateId: string;
			caseId: string;
			caseTitle: string;
			completedAt: number;
			studentDisplayName: string;
			studentProfileId: string;
		}>;
	},
) {
	const response = await request.post("/api/e2e/student-dashboard/state", {
		data,
	});

	expect(response.ok()).toBe(true);
}

test.describe("Student dashboard", () => {
	test.beforeAll(async ({ request }) => {
		const response = await request.get("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test.afterEach(async ({ request }) => {
		const response = await request.delete("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test("shows active case and newest three certificates for a verified student", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-dashboard-active");
		const profileId = e2eStudentProfileId(email);
		const publishedAt = Date.now() - dayInMilliseconds;
		const deadlineAt = Date.now() + 14 * dayInMilliseconds;

		await seedStudentDashboard(request, {
			activeCase: {
				description:
					"Learn how patients with a serious infection can be managed in outpatient settings with the help of an OPAT service.",
				title: "Acute endocrine case review",
				publishedAt,
				deadlineAt,
			},
			certificates: [
				{
					certificateBranding,
					certificateId: "certificate-newest",
					caseId: "case-newest",
					caseTitle: "Cardiac rehabilitation follow-up",
					completedAt: publishedAt,
					studentDisplayName: "Jordan Adebayo",
					studentProfileId: profileId,
				},
				{
					certificateBranding,
					certificateId: "certificate-middle",
					caseId: "case-middle",
					caseTitle: "Respiratory complications review",
					completedAt: publishedAt - dayInMilliseconds,
					studentDisplayName: "Jordan Adebayo",
					studentProfileId: profileId,
				},
				{
					certificateBranding,
					certificateId: "certificate-third",
					caseId: "case-third",
					caseTitle: "Metabolic emergency discussion",
					completedAt: publishedAt - 2 * dayInMilliseconds,
					studentDisplayName: "Jordan Adebayo",
					studentProfileId: profileId,
				},
				{
					certificateBranding,
					certificateId: "certificate-oldest",
					caseId: "case-oldest",
					caseTitle: "Older hidden certificate",
					completedAt: publishedAt - 3 * dayInMilliseconds,
					studentDisplayName: "Jordan Adebayo",
					studentProfileId: profileId,
				},
				{
					certificateBranding,
					certificateId: "other-student-certificate",
					caseId: "case-other",
					caseTitle: "Other student certificate",
					completedAt: Date.now(),
					studentDisplayName: "Morgan Lee",
					studentProfileId: "other-student",
				},
			],
		});
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);

		await expect(page.getByTestId("student-dashboard-root")).toBeVisible();
		await expect(page.getByTestId("student-dashboard-heading")).toHaveText(
			"Welcome back, Jordan",
		);
		await expect(page.getByTestId("student-active-case-title")).toHaveText(
			"Acute endocrine case review",
		);
		await expect(
			page.getByTestId("student-active-case-description"),
		).toHaveText(
			"Learn how patients with a serious infection can be managed in outpatient settings with the help of an OPAT service.",
		);
		await expect(page.getByTestId("student-active-case-expiration")).toHaveText(
			`Deadline: ${formatDubaiDate(deadlineAt)} UAE`,
		);
		await expect(page.getByTestId("student-active-case-cta")).toHaveText(
			"View Case Study",
		);
		await expect(page.getByTestId("student-recent-certificate-card")).toHaveCount(
			3,
		);
		await expect(page.getByTestId("student-recent-certificates")).toContainText(
			"Cardiac rehabilitation follow-up",
		);
		await expect(
			page.getByTestId("student-recent-certificates"),
		).not.toContainText("Older hidden certificate");
		await expect(page.getByTestId("student-certificate-download-link")).toHaveCount(
			3,
		);

		const download = await Promise.all([
			page.waitForEvent("download"),
			page.getByTestId("student-certificate-download-link").first().click(),
		]);
		expect(download[0].suggestedFilename()).toMatch(/^certificate-.*\.pdf$/);
		const downloadPath = await download[0].path();
		if (!downloadPath) {
			throw new Error("Expected certificate PDF download to have a local path.");
		}
		const pdfContents = await readFile(downloadPath, "utf8");
		expect(pdfContents).toContain("E-Clinical Case Solutions");
		expect(pdfContents).toContain("Jordan Adebayo");
		expect(pdfContents).toContain("Cardiac rehabilitation follow-up");
		expect(pdfContents).not.toContain("Certificate ID");
		expect(pdfContents).not.toContain("certificate-newest");

		await page.getByTestId("student-view-all-certificates-link").click();
		await expect(page).toHaveURL(/\/student\/certificates$/);
		await expect(
			page.getByTestId("student-certificate-history-card"),
		).toHaveCount(4);
		await expect(page.getByTestId("student-certificate-preview")).toHaveCount(4);
		const newestCertificateCard = page
			.getByTestId("student-certificate-history-card")
			.first();

		await expect(
			newestCertificateCard,
		).toContainText("E-Clinical Case Solutions");
		await expect(
			newestCertificateCard,
		).toContainText("Jordan Adebayo");
		await expect(
			newestCertificateCard,
		).toContainText("Cardiac rehabilitation follow-up");
		await expect(
			newestCertificateCard,
		).toContainText(formatDubaiDate(publishedAt));
		await expect(
			newestCertificateCard,
		).not.toContainText("Certificate ID");
		await expect(
			newestCertificateCard,
		).not.toContainText("certificate-newest");
		await expect(
			page.getByTestId("student-certificate-history-download-link"),
		).toHaveCount(4);
	});

	test("shows a no-active-case empty state when no active case exists", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-dashboard-empty");

		await seedStudentDashboard(request, { activeCase: null });
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);

		await expect(page.getByTestId("student-dashboard-root")).toBeVisible();
		await expect(
			page.getByTestId("student-dashboard-no-active-case"),
		).toContainText("No active case available");
		await expect(
			page.getByTestId("student-dashboard-no-certificates"),
		).toContainText("No certificates yet");
	});

	test("hides the active case after the student earns its certificate", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-dashboard-completed-active");
		const profileId = e2eStudentProfileId(email);
		const publishedAt = Date.now() - dayInMilliseconds;
		const completedAt = Date.now();

		await seedStudentDashboard(request, {
			activeCase: {
				caseId: "completed-active-case",
				description: "This active case has already been completed.",
				title: "Completed active case review",
				publishedAt,
				deadlineAt: Date.now() + 14 * dayInMilliseconds,
			},
			certificates: [
				{
					certificateBranding,
					certificateId: "certificate-completed-active-case",
					caseId: "completed-active-case",
					caseTitle: "Completed active case review",
					completedAt,
					studentDisplayName: "Jordan Adebayo",
					studentProfileId: profileId,
				},
			],
		});
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);

		await expect(page.getByTestId("student-active-case-banner")).toHaveCount(0);
		await expect(
			page.getByTestId("student-dashboard-no-active-case"),
		).toContainText("No active case available");
		await expect(page.getByTestId("student-recent-certificate-card")).toHaveCount(
			1,
		);
		await expect(page.getByTestId("student-recent-certificates")).toContainText(
			"Completed active case review",
		);
	});
});
