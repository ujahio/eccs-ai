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

	test("reopens a saved draft from All Cases and deletes it with confirmation", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-case-authoring");
		const now = Date.now();

		await bootstrapVerifiedTeacher(request, email);
		const dashboardResponse = await request.post(
			"/api/e2e/teacher-dashboard/state",
			{
				data: {
					activeCase: null,
					archivedCases: [
						{
							title: "Archived renal case discussion",
							publishedAt: now - 28 * dayInMilliseconds,
							deadlineAt: now - 14 * dayInMilliseconds,
							archivedAt: now - 14 * dayInMilliseconds,
							completionCount: 9,
							feedbackCount: 3,
						},
					],
				},
			},
		);
		expect(dashboardResponse.ok()).toBe(true);
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
		await expect(page).toHaveURL(/\/teacher\/cases\/[^/]+\/edit$/);
		const editPath = new URL(page.url()).pathname;

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

		await page.getByTestId("teacher-cases-link").click();
		await expect(page).toHaveURL(/\/teacher\/cases$/);
		await expect(page.getByTestId("teacher-case-library-root")).toBeVisible();
		await expect(page.getByTestId("teacher-draft-case-card")).toHaveCount(1);
		await expect(page.getByTestId("teacher-draft-cases")).toContainText(
			"Acute endocrine review",
		);
		await expect(page.getByTestId("teacher-draft-cases")).toContainText("PDFs 1");
		await page.getByTestId("teacher-case-library-archived-mode").click();
		await expect(page.getByTestId("teacher-library-archived-cases")).toContainText(
			"Archived renal case discussion",
		);
		await page.getByTestId("teacher-case-library-draft-mode").click();

		await page.getByTestId("teacher-draft-edit").click();
		await expect(page).toHaveURL(new RegExp(`${editPath}$`));
		await expect(page.getByTestId("teacher-case-title")).toHaveValue(
			"Acute endocrine review",
		);
		await page.getByTestId("teacher-case-section-resources").click();
		await expect(page.getByTestId("teacher-case-pdf-list")).toContainText(
			"teaching-resource.pdf",
		);

		await page.getByTestId("teacher-cases-link").click();
		await page.getByTestId("teacher-draft-delete").click();
		await expect(page.getByTestId("teacher-delete-draft-dialog")).toBeVisible();
		await page.getByTestId("teacher-delete-draft-cancel").click();
		await expect(page.getByTestId("teacher-delete-draft-dialog")).toBeHidden();
		await expect(page.getByTestId("teacher-draft-case-card")).toHaveCount(1);

		await page.getByTestId("teacher-draft-delete").click();
		await page.getByTestId("teacher-delete-draft-confirm").click();
		await expect(page.getByTestId("teacher-case-library-no-drafts")).toBeVisible();
		await expect(page.getByTestId("teacher-draft-case-card")).toHaveCount(0);

		await page.goto(editPath);
		await expect(page.getByTestId("teacher-case-draft-load-error")).toBeVisible();
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

	test("publishes a complete case immediately as the active case", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-case-publish");

		await bootstrapVerifiedTeacher(request, email);
		await loginTeacher(page, email);
		await page.getByTestId("teacher-start-case-button").click();

		await page.getByTestId("teacher-case-title").fill("Acute endocrine review");
		await page
			.getByTestId("teacher-case-description")
			.fill("A focused review for learners preparing for endocrine cases.");
		await page.getByTestId("teacher-case-section-presentation").click();
		await page
			.getByTestId("teacher-case-presentation")
			.fill(
				"Patient history, presenting symptoms, laboratory findings, and the clinical decision context are described with enough detail for learners to reason carefully.",
			);
		await page.getByTestId("teacher-case-section-modelAnswer").click();
		await page
			.getByTestId("teacher-case-model-answer")
			.fill(
				"The model answer explains the diagnostic path, key discriminating findings, management priorities, and teaching points for comparison.",
			);
		await page.getByTestId("teacher-case-section-resources").click();
		await page
			.getByTestId("teacher-case-lecture-text")
			.fill(
				"Case Study resources summarize the core physiology, common diagnostic pitfalls, and next-step management considerations for review.",
			);
		await page
			.getByTestId("teacher-case-resource-deadline-date")
			.fill("2026-08-12");
		await page.getByTestId("teacher-case-section-cme").click();

		for (let questionIndex = 0; questionIndex < 3; questionIndex += 1) {
			await page
				.getByTestId("teacher-case-cme-prompt")
				.fill(`Which finding best supports diagnosis ${questionIndex + 1}?`);
			await page
				.getByTestId("teacher-case-cme-option-0")
				.fill(`Correct option ${questionIndex + 1}`);
			await page
				.getByTestId("teacher-case-cme-option-1")
				.fill(`Distractor option ${questionIndex + 1}`);

			if (questionIndex < 2) {
				await page.getByTestId("teacher-case-add-cme-question").click();
			}
		}

		await page.getByTestId("teacher-case-section-review").click();
		await expect(page.getByTestId("teacher-case-publish-readiness")).toContainText(
			"Ready to publish",
		);
		await expect(page.getByTestId("teacher-case-deadline-summary")).toContainText(
			"UAE time",
		);
		await page.getByTestId("teacher-case-publish").click();

		await expect(page).toHaveURL(/\/teacher$/);
		await expect(page.getByTestId("teacher-active-case-card")).toContainText(
			"Acute endocrine review",
		);
	});
});
