import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

function uniqueEmail() {
	return `e2e-reset-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}@example.com`;
}

const validRegistration = {
	firstName: "Jordan",
	lastName: "Adebayo",
	password: "casework1"
};
const newPassword = "newcase1";
const resetRequestedMessage =
	"If this account exists and has a verified email, a reset link has been sent. If you do not receive one, verify your email or contact support.";
const invalidResetLinkMessage =
	"This reset link is invalid, expired, or already used. Request a new reset link.";

async function fetchVerificationUrl(
	request: APIRequestContext,
	email: string
): Promise<string> {
	const response = await request.get(
		`/api/e2e/auth/verification-link?email=${encodeURIComponent(email)}`
	);

	expect(response.ok()).toBe(true);

	const body = await response.json();

	return body.verificationUrl;
}

async function fetchResetUrl(
	request: APIRequestContext,
	email: string
): Promise<string> {
	const response = await request.get(
		`/api/e2e/auth/password-reset-link?email=${encodeURIComponent(email)}`
	);

	expect(response.ok()).toBe(true);

	const body = await response.json();

	return body.resetUrl;
}

async function expectPasswordChangedEmail(
	request: APIRequestContext,
	email: string
) {
	await expect
		.poll(async () => {
			const response = await request.get(
				`/api/e2e/auth/password-changed-email?email=${encodeURIComponent(
					email
				)}`
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
	await page
		.getByTestId("register-last-name")
		.fill(validRegistration.lastName);
	await page.getByTestId("register-email").fill(email);
	await page.getByTestId("register-password").fill(validRegistration.password);
	await page.getByTestId("register-submit").click();

	await expect(page.getByTestId("register-success-message")).toBeVisible();
}

async function verifyStudentEmail(
	page: Page,
	request: APIRequestContext,
	email: string
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

test.describe("Student password reset", () => {
	test.beforeAll(async ({ request }) => {
		const response = await request.get("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test.afterEach(async ({ request }) => {
		const response = await request.delete("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test("resets password through a code-only link and invalidates existing app sessions", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await registerStudent(page, email);
		await verifyStudentEmail(page, request, email);
		await loginStudent(page, email, validRegistration.password);
		await expect(page).toHaveURL(/\/student$/);

		await page.goto("/forgot-password");
		await page.getByTestId("forgot-password-email").fill(email);
		await page.getByTestId("forgot-password-submit").click();

		await expect(
			page.getByTestId("forgot-password-success-message")
		).toHaveText(resetRequestedMessage);

		const resetUrl = await fetchResetUrl(request, email);
		const parsedResetUrl = new URL(resetUrl);

		expect(parsedResetUrl.pathname).toBe("/reset-password");
		expect(parsedResetUrl.searchParams.has("code")).toBe(true);
		expect(parsedResetUrl.searchParams.has("email")).toBe(false);

		await page.goto(resetUrl);
		await page.getByTestId("reset-password-email").fill(email);
		await page.getByTestId("reset-password-new-password").fill(newPassword);
		await page
			.getByTestId("reset-password-confirm-password")
			.fill(newPassword);
		await page.getByTestId("reset-password-submit").click();

		await expect(page).toHaveURL(/\/login\?reset=changed$/);
		await expect(page.getByTestId("login-success-message")).toHaveText(
			"Your password was changed. Please sign in."
		);
		await expectPasswordChangedEmail(request, email);

		await page.goto("/student");
		await expect(page).toHaveURL(/\/login$/);

		await loginStudent(page, email, validRegistration.password);
		await expect(page.getByTestId("login-error-message")).toHaveText(
			"Invalid email or password."
		);

		await loginStudent(page, email, newPassword);
		await expect(page).toHaveURL(/\/student$/);
	});

	test("shows validation errors for reset confirmation mismatches", async ({
		page
	}) => {
		await page.goto("/reset-password?code=123456");
		await page.getByTestId("reset-password-email").fill("not-an-email");
		await page.getByTestId("reset-password-new-password").fill("short");
		await page
			.getByTestId("reset-password-confirm-password")
			.fill("different");

		await page.evaluate(() => {
			const form = document.querySelector<HTMLFormElement>(
				'[data-testid="reset-password-form"]'
			);

			if (form) {
				form.setAttribute("novalidate", "");
			}
		});
		await page.getByTestId("reset-password-submit").click();

		await expect(page.getByTestId("reset-password-email-error")).toHaveText(
			"Enter a valid email address."
		);
		await expect(
			page.getByTestId("reset-password-new-password-error")
		).toHaveText(
			"Password is missing: at least 8 characters, at least one number."
		);
		await expect(
			page.getByTestId("reset-password-confirm-password-error")
		).toHaveText("Passwords do not match.");
	});

	test("routes missing, malformed, or invalid reset codes back to request a new link", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await page.goto("/reset-password");
		await expect(page).toHaveURL(/\/forgot-password\?reset=invalid$/);
		await expect(page.getByTestId("forgot-password-notice-message")).toHaveText(
			invalidResetLinkMessage
		);

		await page.goto("/reset-password?code=nonsensecode");
		await expect(page).toHaveURL(/\/forgot-password\?reset=invalid$/);
		await expect(page.getByTestId("forgot-password-notice-message")).toHaveText(
			invalidResetLinkMessage
		);

		await registerStudent(page, email);
		await verifyStudentEmail(page, request, email);

		await page.goto("/reset-password?code=000000");
		await page.getByTestId("reset-password-email").fill(email);
		await page.getByTestId("reset-password-new-password").fill(newPassword);
		await page
			.getByTestId("reset-password-confirm-password")
			.fill(newPassword);
		await page.getByTestId("reset-password-submit").click();

		await expect(page).toHaveURL(/\/forgot-password\?reset=invalid$/);
		await expect(page.getByTestId("forgot-password-notice-message")).toHaveText(
			invalidResetLinkMessage
		);
	});

	test("canonicalizes unknown password-reset status query values", async ({
		page
	}) => {
		await page.goto("/forgot-password?reset=lalalalalalallala");
		await expect(page).toHaveURL(/\/forgot-password$/);
		await expect(
			page.getByTestId("forgot-password-notice-message")
		).toBeHidden();

		await page.goto("/login?reset=lalalalalalallala");
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByTestId("login-success-message")).toBeHidden();

		await page.goto("/login?verification=lalalalalalallala");
		await expect(page).toHaveURL(/\/login$/);

		await page.goto("/login?auth=lalalalalalallala");
		await expect(page).toHaveURL(/\/login$/);
	});

	test("explains the verified-email requirement without sending reset email for unverified accounts", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await registerStudent(page, email);

		await page.goto("/forgot-password");
		await page.getByTestId("forgot-password-email").fill(email);
		await page.getByTestId("forgot-password-submit").click();

		await expect(
			page.getByTestId("forgot-password-success-message")
		).toHaveText(resetRequestedMessage);

		const resetEmail = await request.get(
			`/api/e2e/auth/password-reset-link?email=${encodeURIComponent(email)}`
		);

		expect(resetEmail.status()).toBe(404);
	});

	test("rate-limits repeated reset requests in the memory harness", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await registerStudent(page, email);
		await verifyStudentEmail(page, request, email);

		for (let i = 0; i < 5; i++) {
			await page.goto("/forgot-password");
			await page.getByTestId("forgot-password-email").fill(email);
			await page.getByTestId("forgot-password-submit").click();
			await expect(
				page.getByTestId("forgot-password-success-message")
			).toBeVisible();
		}

		await page.goto("/forgot-password");
		await page.getByTestId("forgot-password-email").fill(email);
		await page.getByTestId("forgot-password-submit").click();

		await expect(
			page.getByTestId("forgot-password-notice-message")
		).toHaveText("Too many password reset requests. Try again later.");
	});
});
