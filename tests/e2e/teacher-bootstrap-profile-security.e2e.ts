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

const temporaryPassword = "Temporary1!";
const permanentPassword = "Permanent1!";
const changedPassword = "Newcase1!";

async function bootstrapTeacher(
	request: APIRequestContext,
	email: string,
	options: {
		emailVerified?: boolean;
		forcePasswordChange?: boolean;
	} = {},
) {
	const response = await request.post("/api/e2e/auth/state", {
		data: {
			action: "bootstrap_teacher",
			email,
			firstName: "Taylor",
			lastName: "Smith",
			temporaryPassword,
			...options,
		},
	});

	expect(response.ok()).toBe(true);
}

async function login(page: Page, email: string, password: string) {
	await page.goto("/login");
	await expect(page.getByTestId("login-form")).toHaveAttribute(
		"data-client-ready",
		"true",
	);
	await page.getByTestId("login-email").fill(email);
	await page.getByTestId("login-password").fill(password);
	await page.getByTestId("login-submit").click();
}

async function fetchEmailChangeVerificationUrl(
	request: APIRequestContext,
	email: string,
): Promise<string> {
	const response = await request.get(
		`/api/e2e/auth/email-change-verification-link?email=${encodeURIComponent(
			email,
		)}`,
	);

	expect(response.ok()).toBe(true);

	const body = await response.json();

	return body.verificationUrl;
}

async function expectPasswordChangedEmail(
	request: APIRequestContext,
	email: string,
) {
	await expect
		.poll(async () => {
			const response = await request.get(
				`/api/e2e/auth/password-changed-email?email=${encodeURIComponent(
					email,
				)}`,
			);

			expect(response.ok()).toBe(true);

			const body = await response.json();

			return body.sent;
		})
		.toBe(true);
}

test.describe("Teacher bootstrap and profile security", () => {
	test.beforeAll(async ({ request }) => {
		const response = await request.get("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test.afterEach(async ({ request }) => {
		const response = await request.delete("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test("completes first-login password setup, reaches teacher dashboard, and updates profile security", async ({
		browser,
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher");
		const newEmail = uniqueEmail("teacher-new");

		await bootstrapTeacher(request, email);

		await page.goto("/teacher");
		await expect(page).toHaveURL(/\/login$/);

		await page.setViewportSize({ width: 390, height: 844 });
		await login(page, email, temporaryPassword);
		await expect(page.getByTestId("teacher-first-login-password-form")).toBeVisible();
		await page
			.getByTestId("teacher-first-login-new-password")
			.fill(permanentPassword);
		await page
			.getByTestId("teacher-first-login-confirm-password")
			.fill(permanentPassword);
		await page.getByTestId("teacher-first-login-password-submit").click();
		await expect(page).toHaveURL(/\/teacher$/);
		await expect(page.getByTestId("teacher-dashboard-root")).toBeVisible();

		await page.getByTestId("teacher-account-menu-trigger").click();
		await expect(page.getByTestId("teacher-account-menu-dashboard")).toBeVisible();
		await page.getByTestId("teacher-account-menu-profile").click();
		await expect(page.getByTestId("teacher-profile-personal-tab")).toBeVisible();

		await page.setViewportSize({ width: 1280, height: 720 });
		await page.getByTestId("teacher-profile-first-name").fill("Morgan");
		await page.getByTestId("teacher-profile-last-name").fill("Lee");
		await page.getByTestId("teacher-profile-details-submit").click();
		await expect(page.getByTestId("teacher-details-success-message")).toHaveText(
			"Your name has been updated.",
		);

		await page.getByTestId("teacher-profile-new-email").fill(newEmail);
		await page.getByTestId("teacher-profile-details-submit").click();
		await expect(page.getByTestId("teacher-pending-email")).toHaveText(
			"We sent a verification link to your new email address.",
		);

		const emailSessionContext = await browser.newContext();
		const emailSessionPage = await emailSessionContext.newPage();
		await login(emailSessionPage, email, permanentPassword);
		await expect(emailSessionPage).toHaveURL(/\/teacher$/);

		const emailChangeUrl = await fetchEmailChangeVerificationUrl(
			request,
			newEmail,
		);
		await page.goto(emailChangeUrl);
		await expect(page).toHaveURL(/\/teacher\/profile\?email=verified$/);
		await expect(page.getByTestId("teacher-email-verified-message")).toHaveText(
			"Your email address has been updated.",
		);

		await emailSessionPage.goto("/teacher");
		await expect(emailSessionPage).toHaveURL(/\/login$/);
		await emailSessionContext.close();

		await login(page, email, permanentPassword);
		await expect(page.getByTestId("login-error-message")).toHaveText(
			"We couldn’t sign you in with those details. Check your email and password and try again.",
		);

		const olderContext = await browser.newContext();
		const olderPage = await olderContext.newPage();
		await login(olderPage, newEmail, permanentPassword);
		await expect(olderPage).toHaveURL(/\/teacher$/);

		await login(page, newEmail, permanentPassword);
		await expect(page).toHaveURL(/\/teacher$/);
		await page.goto("/teacher/profile");
		await expect(page.getByTestId("teacher-profile-new-email")).toHaveValue(
			newEmail,
		);

		await page.getByTestId("teacher-profile-password-tab").click();
		await page
			.getByTestId("teacher-profile-current-password")
			.fill(permanentPassword);
		await page.getByTestId("teacher-profile-new-password").fill(changedPassword);
		await page
			.getByTestId("teacher-profile-confirm-password")
			.fill(changedPassword);
		await page.getByTestId("teacher-profile-password-submit").click();
		await expect(page.getByTestId("teacher-password-success-message")).toHaveText(
			"Your password was changed.",
		);
		await expectPasswordChangedEmail(request, newEmail);

		await olderPage.goto("/teacher");
		await expect(olderPage).toHaveURL(/\/login$/);
		await olderContext.close();

		await page.goto("/student");
		await expect(page).toHaveURL(/\/login$/);

		await login(page, newEmail, changedPassword);
		await expect(page).toHaveURL(/\/teacher$/);
	});
});
