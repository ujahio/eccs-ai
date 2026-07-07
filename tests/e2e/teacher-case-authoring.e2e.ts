import {
	expect,
	test,
	type APIRequestContext,
	type Page,
} from "@playwright/test";

function uniqueEmail(prefix: string) {
	return `e2e-${prefix}-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}@example.com`;
}

const teacherPassword = "teacher1";

async function bootstrapVerifiedTeacher(
	request: APIRequestContext,
	email: string,
) {
	const response = await request.post("/api/e2e/auth/state", {
		data: {
			action: "bootstrap_teacher",
			email,
			firstName: "Taylor",
			lastName: "Smith",
			temporaryPassword: teacherPassword,
			emailVerified: true,
			forcePasswordChange: false,
		},
	});

	expect(response.ok()).toBe(true);
}

async function login(page: Page, email: string) {
	await page.goto("/login");
	await expect(page.getByTestId("login-form")).toHaveAttribute(
		"data-client-ready",
		"true",
	);
	await page.getByTestId("login-email").fill(email);
	await page.getByTestId("login-password").fill(teacherPassword);
	await page.getByTestId("login-submit").click();
	await expect(page).toHaveURL(/\/teacher$/);
}

test.describe("Teacher case authoring", () => {
	test.afterEach(async ({ request }) => {
		const authResponse = await request.delete("/api/e2e/auth/state");
		expect(authResponse.ok()).toBe(true);
	});

	test("saves an incomplete draft, retains PDF metadata, and validates review readiness", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-case-authoring");

		await bootstrapVerifiedTeacher(request, email);
		await login(page, email);
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
});
