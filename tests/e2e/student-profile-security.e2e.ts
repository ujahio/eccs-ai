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

const validRegistration = {
	firstName: "Jordan",
	lastName: "Adebayo",
	password: "casework1",
};
const changedPassword = "newcase1";
const verificationEmailSentMessage =
	"We just sent a verification link to your inbox. Click the link in that email to confirm your account.";

async function fetchVerificationUrl(
	request: APIRequestContext,
	email: string,
): Promise<string> {
	const response = await request.get(
		`/api/e2e/auth/verification-link?email=${encodeURIComponent(email)}`,
	);

	expect(response.ok()).toBe(true);

	const body = await response.json();

	return body.verificationUrl;
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

async function registerStudent(page: Page, email: string) {
	await page.goto("/register");
	await page
		.getByTestId("register-first-name")
		.fill(validRegistration.firstName);
	await page.getByTestId("register-last-name").fill(validRegistration.lastName);
	await page.getByTestId("register-email").fill(email);
	await page.getByTestId("register-password").fill(validRegistration.password);
	await page.getByTestId("register-submit").click();

	await expect(page).toHaveURL(/\/login\?registration=verification_sent$/);
	await expect(page.getByTestId("login-email")).toHaveValue("");
	await expect(page.getByTestId("login-success-message")).toHaveText(
		verificationEmailSentMessage,
	);
}

async function verifyStudentEmail(
	page: Page,
	request: APIRequestContext,
	email: string,
) {
	const verificationUrl = await fetchVerificationUrl(request, email);

	await page.goto(verificationUrl);
	await expect(page).toHaveURL(/\/login\?verification=verified/);
}

async function loginStudent(page: Page, email: string, password: string) {
	await page.goto("/login");
	await page.getByTestId("login-email").fill(email);
	await page.getByTestId("login-password").fill(password);
	await page.getByTestId("login-submit").click();
}

test.describe("Student profile security", () => {
	test.beforeAll(async ({ request }) => {
		const response = await request.get("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test.afterEach(async ({ request }) => {
		const response = await request.delete("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test("updates profile name, verifies email change, and changes password while preserving the current password session", async ({
		browser,
		page,
		request,
	}) => {
		const email = uniqueEmail("profile");
		const newEmail = uniqueEmail("new-profile");

		await registerStudent(page, email);
		await verifyStudentEmail(page, request, email);

		const olderContext = await browser.newContext();
		const olderPage = await olderContext.newPage();
		await loginStudent(olderPage, email, validRegistration.password);
		await expect(olderPage).toHaveURL(/\/student$/);

		await loginStudent(page, email, validRegistration.password);
		await expect(page).toHaveURL(/\/student$/);

		await page.getByTestId("student-account-menu-trigger").click();
		await page.getByTestId("student-account-menu-profile").click();
		await expect(
			page.getByTestId("student-profile-personal-tab"),
		).toBeVisible();
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByAltText("E-Clinical Case Solutions")).toBeVisible();
		await page.getByTestId("student-account-menu-trigger").click();
		await expect(
			page.getByTestId("student-account-menu-dashboard"),
		).toBeVisible();
		await expect(
			page.getByTestId("student-account-menu-certificates"),
		).toBeVisible();
		await page.getByTestId("student-account-menu-profile").click();
		await expect(
			page.getByTestId("student-profile-personal-tab"),
		).toBeVisible();
		await page.setViewportSize({ width: 1280, height: 720 });

		await page.getByTestId("student-profile-first-name").fill("Alex");
		await page.getByTestId("student-profile-last-name").fill("Chen");
		await page.getByTestId("student-profile-details-submit").click();
		await expect(
			page.getByTestId("student-details-success-message"),
		).toHaveText("Your name has been updated.");

		await page.getByTestId("student-profile-new-email").fill(newEmail);
		await page.getByTestId("student-profile-details-submit").click();
		await expect(
			page.getByTestId("student-pending-email"),
		).toHaveText(
			"We sent a verification link to your new email address.",
		);
		await expect(
			page.getByTestId("student-details-success-message"),
		).toHaveCount(0);

		const emailChangeUrl = await fetchEmailChangeVerificationUrl(
			request,
			newEmail,
		);
		await page.goto(emailChangeUrl);
		await expect(page).toHaveURL(/\/login\?emailChange=verified$/);
		await expect(page.getByTestId("login-success-message")).toHaveText(
			"Your email address has been updated.",
		);

		await olderPage.goto("/student");
		await expect(olderPage).toHaveURL(/\/login$/);
		await olderContext.close();

		await loginStudent(page, email, validRegistration.password);
		await expect(page.getByTestId("login-error-message")).toHaveText(
			"We couldn’t sign you in with those details. Check your email and password and try again.",
		);

		await loginStudent(page, newEmail, validRegistration.password);
		await expect(page).toHaveURL(/\/student$/);
		await page.goto("/student/profile");
		await expect(page.getByTestId("student-profile-new-email")).toHaveValue(
			newEmail,
		);

		await page.getByTestId("student-profile-password-tab").click();
		await page
			.getByTestId("student-profile-current-password")
			.fill(validRegistration.password);
		await page
			.getByTestId("student-profile-new-password")
			.fill(changedPassword);
		await page
			.getByTestId("student-profile-confirm-password")
			.fill(changedPassword);
		await page.getByTestId("student-profile-password-submit").click();
		await expect(
			page.getByTestId("student-password-success-message"),
		).toHaveText("Your password was changed.");
		await expectPasswordChangedEmail(request, newEmail);

		await page.goto("/student/profile");
		await expect(
			page.getByTestId("student-profile-personal-tab"),
		).toBeVisible();

		await page.getByTestId("student-account-menu-trigger").click();
		await page.getByTestId("student-logout-button").click();
		await expect(page).toHaveURL(/\/login$/);

		await loginStudent(page, newEmail, validRegistration.password);
		await expect(page.getByTestId("login-error-message")).toHaveText(
			"We couldn’t sign you in with those details. Check your email and password and try again.",
		);

		await loginStudent(page, newEmail, changedPassword);
		await expect(page).toHaveURL(/\/student$/);
	});
});
