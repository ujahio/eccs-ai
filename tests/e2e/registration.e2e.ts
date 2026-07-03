import { expect, test } from "@playwright/test";

function uniqueEmail() {
	return `e2e-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function fetchVerificationUrl(
	request: import("@playwright/test").APIRequestContext,
	email: string
): Promise<string> {
	const response = await request.get(
		`/api/e2e/auth/verification-link?email=${encodeURIComponent(email)}`
	);

	expect(response.ok()).toBe(true);

	const body = await response.json();

	return body.verificationUrl;
}

const validRegistration = {
	firstName: "Jordan",
	lastName: "Adebayo",
	password: "casework1"
};

test.describe("Student registration and email verification", () => {
	test.beforeAll(async ({ request }) => {
		const response = await request.get("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
		expect(response.status()).toBe(200);
	});

	test.afterEach(async ({ request }) => {
		const response = await request.delete("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test("shows validation errors for empty submission", async ({ page }) => {
		await page.goto("/register");

		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-first-name-error")).toHaveText(
			"Enter your first name."
		);
		await expect(page.getByTestId("register-last-name-error")).toHaveText(
			"Enter your last name."
		);
		await expect(page.getByTestId("register-email-error")).toHaveText(
			"Enter your email address."
		);
		await expect(page.getByTestId("register-password-error")).toHaveText(
			"Password is missing: at least 8 characters, at least one lowercase letter, at least one number."
		);
	});

	test("shows validation error for invalid email format", async ({ page }) => {
		await page.goto("/register");

		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill("not-an-email");
		await page.getByTestId("register-password").fill(validRegistration.password);

		await page.evaluate(() => {
			const form = document.querySelector<HTMLFormElement>(
				'[data-testid="register-form"]'
			);

			if (form) {
				form.setAttribute("novalidate", "");
			}
		});
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-email-error")).toHaveText(
			"Enter a valid email address."
		);
	});

	test("shows validation error for weak password", async ({ page }) => {
		await page.goto("/register");

		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(uniqueEmail());
		await page.getByTestId("register-password").fill("short");
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-password-error")).toHaveText(
			"Password is missing: at least 8 characters, at least one number."
		);
		await expect(
			page.getByTestId("register-password-requirement-minimumLength")
		).toHaveText("Required: At least 8 characters");
		await expect(
			page.getByTestId("register-password-requirement-lowercase")
		).toHaveCount(0);
		await expect(
			page.getByTestId("register-password-requirement-number")
		).toHaveText("Required: At least one number");
	});

	test("shows validation error for password without lowercase letter", async ({
		page
	}) => {
		await page.goto("/register");

		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(uniqueEmail());
		await page.getByTestId("register-password").fill("PASSWORD1");
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-password-error")).toHaveText(
			"Password is missing: at least one lowercase letter."
		);
	});

	test("shows validation error for password without number", async ({ page }) => {
		await page.goto("/register");

		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(uniqueEmail());
		await page.getByTestId("register-password").fill("casework");
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-password-error")).toHaveText(
			"Password is missing: at least one number."
		);
	});

	test("successful registration shows verification email notice", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await page.goto("/register");
		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-success-message")).toHaveText(
			"Check your email. Verification expires in 24 hours."
		);

		const verificationUrl = await fetchVerificationUrl(request, email);

		expect(verificationUrl).toContain("/verify-email?token=");
	});

	test("verification link redirects to login with verified message", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await page.goto("/register");
		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-success-message")).toBeVisible();

		const verificationUrl = await fetchVerificationUrl(request, email);

		await page.goto(verificationUrl);

		await expect(page).toHaveURL(/\/login\?verification=verified/);
		await expect(page.getByTestId("login-success-message")).toHaveText(
			"Your email has been verified. Please sign in."
		);
	});

	test("verified student can sign in and reach the student dashboard", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await page.goto("/register");
		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-success-message")).toBeVisible();

		const verificationUrl = await fetchVerificationUrl(request, email);

		await page.goto(verificationUrl);
		await expect(page).toHaveURL(/\/login\?verification=verified/);

		await page.getByTestId("login-email").fill(email);
		await page.getByTestId("login-password").fill(validRegistration.password);
		await page.getByTestId("login-submit").click();

		await expect(page).toHaveURL(/\/student$/);
		await expect(page.getByTestId("student-dashboard-heading")).toBeVisible();
	});

	test("login is blocked before email verification", async ({ page }) => {
		const email = uniqueEmail();

		await page.goto("/register");
		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-success-message")).toBeVisible();

		await page.goto("/login");
		await page.getByTestId("login-email").fill(email);
		await page.getByTestId("login-password").fill(validRegistration.password);
		await page.getByTestId("login-submit").click();

		await expect(page.getByTestId("login-blocked-message")).toHaveText(
			"Verify your email before signing in."
		);
	});

	test("duplicate pending registration triggers resend", async ({
		page,
		request
	}) => {
		const email = uniqueEmail();

		await page.goto("/register");
		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-success-message")).toBeVisible();

		await page.getByTestId("register-first-name").fill("Changed");
		await page.getByTestId("register-last-name").fill("Name");
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-success-message")).toHaveText(
			"Verification email sent. Please check your inbox."
		);

		const verificationUrl = await fetchVerificationUrl(request, email);

		expect(verificationUrl).toContain("/verify-email?token=");
	});

	test("rate-limits repeated verification resends", async ({ page }) => {
		const email = uniqueEmail();

		await page.goto("/register");

		for (let i = 0; i < 3; i++) {
			await page.getByTestId("register-first-name").fill(
				validRegistration.firstName
			);
			await page.getByTestId("register-last-name").fill(
				validRegistration.lastName
			);
			await page.getByTestId("register-email").fill(email);
			await page.getByTestId("register-password").fill(
				validRegistration.password
			);
			await page.getByTestId("register-submit").click();

			await expect(
				page.getByTestId("register-success-message")
			).toBeVisible();
		}

		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-resend-notice")).toHaveText(
			"Maximum requests reached. Try again after the verification link expires."
		);
	});

	test("registration remains blocked after rate limit until verification expires", async ({
		page
	}) => {
		const email = uniqueEmail();

		await page.goto("/register");

		for (let i = 0; i < 3; i++) {
			await page.getByTestId("register-first-name").fill(
				validRegistration.firstName
			);
			await page.getByTestId("register-last-name").fill(
				validRegistration.lastName
			);
			await page.getByTestId("register-email").fill(email);
			await page.getByTestId("register-password").fill(
				validRegistration.password
			);
			await page.getByTestId("register-submit").click();

			await expect(
				page.getByTestId("register-success-message")
			).toBeVisible();
		}

		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-resend-notice")).toBeVisible();

		await page.getByTestId("register-first-name").fill(validRegistration.firstName);
		await page.getByTestId("register-last-name").fill(validRegistration.lastName);
		await page.getByTestId("register-email").fill(email);
		await page.getByTestId("register-password").fill(validRegistration.password);
		await page.getByTestId("register-submit").click();

		await expect(page.getByTestId("register-resend-notice")).toHaveText(
			"Maximum requests reached. Try again after the verification link expires."
		);
	});
});
