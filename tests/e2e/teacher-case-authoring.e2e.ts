import { expect, test } from "@playwright/test";
import {
	bootstrapVerifiedTeacher,
	dayInMilliseconds,
	loginTeacher,
	resetTeacherE2EState,
	uniqueEmail,
} from "./teacher-helpers";

test.describe("Teacher case authoring", () => {
	test.afterEach(async ({ request }) => {
		await resetTeacherE2EState(request);
	});

	test("saves an incomplete draft, retains PDF attachments, and validates review readiness", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-case-authoring");

		await bootstrapVerifiedTeacher(request, email);
		await loginTeacher(page, email);
		await page.getByTestId("teacher-start-case-button").click();
		await expect(page).toHaveURL(/\/teacher\/cases\/new$/);
		await expect(page.getByTestId("teacher-case-authoring-root")).toBeVisible();

		await page.getByTestId("teacher-case-title").fill("Acute endocrine review");
		await page
			.getByTestId("teacher-case-description")
			.fill("A draft description that can be saved before completion.");
		await expect(page.getByTestId("teacher-case-dirty-message")).toBeVisible();
		await page.getByTestId("teacher-case-save-draft").click();
		await expect(page.getByTestId("teacher-case-draft-saved")).toHaveText(
			"Draft saved.",
		);

		await page.getByTestId("teacher-case-section-resources").click();
		await page
			.getByTestId("teacher-case-lecture-text")
			.fill("Short resource notes saved before the full publish validation passes.");
		await page
			.getByTestId("teacher-case-resource-deadline-date")
			.fill("2026-08-12");
		await page.getByTestId("teacher-case-pdf-attachments").setInputFiles({
			name: "teaching-resource.pdf",
			mimeType: "application/pdf",
			buffer: Buffer.from("%PDF-1.4\n% e2e placeholder\n"),
		});
		await expect(page.getByTestId("teacher-case-pdf-list")).toContainText(
			"teaching-resource.pdf",
		);
		await page.getByTestId("teacher-case-save-draft").click();
		await expect(page.getByTestId("teacher-case-draft-saved")).toHaveText(
			"Draft saved.",
		);

		await page.reload();
		await expect(page.getByTestId("teacher-case-title")).toHaveValue(
			"Acute endocrine review",
		);
		await page.getByTestId("teacher-case-section-resources").click();
		await expect(page.getByTestId("teacher-case-pdf-list")).toContainText(
			"teaching-resource.pdf",
		);

		await page.getByTestId("teacher-case-section-cme").click();
		await expect(page.getByTestId("teacher-case-cme-counter")).toHaveText(
			"Question 1",
		);
		await expect(page.getByTestId("teacher-case-cme-validation")).toHaveText(
			"Add 3 to 5 CME questions.",
		);

		await page.getByTestId("teacher-case-section-review").click();
		await expect(page.getByTestId("teacher-case-publish-readiness")).toContainText(
			"Draft can be saved",
		);
		await expect(page.getByTestId("teacher-case-publish")).toBeDisabled();
	});

	test("blocks publishing while another case is active", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-case-active-publish-blocker");
		const now = Date.now();

		await bootstrapVerifiedTeacher(request, email);
		const dashboardResponse = await request.post(
			"/api/e2e/teacher-dashboard/state",
			{
				data: {
					activeCase: {
						title: "Currently active endocrine case",
						publishedAt: now - dayInMilliseconds,
						deadlineAt: now + 14 * dayInMilliseconds,
						completionCount: 0,
						feedbackCount: 0,
					},
				},
			},
		);
		expect(dashboardResponse.ok()).toBe(true);

		await loginTeacher(page, email);
		await page.getByTestId("teacher-start-case-button").click();
		await page.getByTestId("teacher-case-section-review").click();

		await expect(
			page.getByTestId("teacher-case-active-publish-blocker"),
		).toContainText("Currently active endocrine case");
		await expect(page.getByTestId("teacher-case-publish")).toBeDisabled();
	});
});
