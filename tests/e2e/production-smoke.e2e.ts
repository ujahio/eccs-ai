import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const studentPassword = smokePassword("Student");
const resetPassword = smokePassword("Reset");
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const emailLinkTimeoutMs = Number(
	process.env.PRODUCTION_SMOKE_EMAIL_LINK_TIMEOUT_MS ?? 120_000,
);

type EmailLinkKind = "registration" | "password_reset";

type RealInfraSmokeConfig = {
	appBaseUrl: string;
	studentEmailDomain: string;
	teacherEmail: string;
	teacherTemporaryPassword?: string;
	teacherPassword: string;
};

let smokeConfig: RealInfraSmokeConfig;

test.describe("Production smoke @production-smoke", () => {
	test.describe.configure({ mode: "serial" });
	test.setTimeout(180_000);
	test.skip(
		process.env.REAL_INFRA_SMOKE !== "1",
		"Production smoke tests run only when REAL_INFRA_SMOKE=1 is set.",
	);

	test.beforeAll(() => {
		smokeConfig = realInfraSmokeConfig();
	});

	test("student can register, verify email, and log in @production-smoke", async ({
		page,
	}) => {
		const email = uniqueStudentEmail("registration");

		await registerVerifiedStudent(page, email);
		await login(page, email, studentPassword, /\/student$/);

		await expect(page.getByTestId("student-dashboard-root")).toBeVisible();
	});

	test("teacher can publish a case with an attachment, and a student can complete it and download the certificate @production-smoke", async ({
		page,
	}) => {
		const caseTitle = `Production Smoke Case ${uniqueRunId()}`;
		const studentEmail = uniqueStudentEmail("case-completion");

		await loginTeacher(
			page,
			smokeConfig.teacherEmail,
			smokeConfig.teacherTemporaryPassword ?? smokeConfig.teacherPassword,
			smokeConfig.teacherPassword,
		);
		await expect(page.getByTestId("teacher-dashboard-root")).toBeVisible();
		await expect(
			page.getByTestId("teacher-dashboard-no-active-case"),
			"Production smoke publishing requires a clean deployed stage with no active case.",
		).toBeVisible();

		await publishCaseWithAttachment(page, caseTitle);
		await expect(page.getByTestId("teacher-active-case-card")).toContainText(
			caseTitle,
		);

		await registerVerifiedStudent(page, studentEmail);
		await login(page, studentEmail, studentPassword, /\/student$/);
		await expect(page.getByTestId("student-active-case-title")).toContainText(
			caseTitle,
		);
		await page.getByTestId("student-active-case-cta").click();

		await completeStudentCase(page);

		const downloadPromise = page.waitForEvent("download");
		await page.getByTestId("student-case-certificate-download").click();
		const download = await downloadPromise;

		expect(await download.failure()).toBeNull();
		expect(download.suggestedFilename()).toMatch(/^certificate-.+\.pdf$/);

		await page.getByTestId("student-case-certificate-history").click();
		await expect(page).toHaveURL(/\/student\/certificates$/);
		await expect(page.getByTestId("student-certificate-history-card")).toContainText(
			caseTitle,
		);
	});

	test("student can reset password and log in with the new password @production-smoke", async ({
		page,
	}) => {
		const email = uniqueStudentEmail("password-reset");

		await registerVerifiedStudent(page, email);
		await login(page, email, studentPassword, /\/student$/);

		const resetRequestedAt = Date.now();
		await page.goto("/forgot-password");
		await page.getByTestId("forgot-password-email").fill(email);
		await page.getByTestId("forgot-password-submit").click();
		await expect(page.getByTestId("forgot-password-success-message")).toHaveText(
			"If this account exists and has a verified email, a reset link has been sent. If you do not receive one, verify your email or contact support.",
		);

		const resetUrl = await waitForEmailLink({
			email,
			kind: "password_reset",
			sentAfterMs: resetRequestedAt,
		});
		const parsedResetUrl = new URL(resetUrl);

		expect(parsedResetUrl.pathname).toBe("/reset-password");
		expect(parsedResetUrl.searchParams.has("code")).toBe(true);
		expect(parsedResetUrl.searchParams.has("email")).toBe(false);

		await page.goto(appOriginUrl(resetUrl));
		await page.getByTestId("reset-password-email").fill(email);
		await page.getByTestId("reset-password-new-password").fill(resetPassword);
		await page
			.getByTestId("reset-password-confirm-password")
			.fill(resetPassword);
		await page.getByTestId("reset-password-submit").click();

		await expect(page).toHaveURL(/\/login\?reset=changed$/);
		await expect(page.getByTestId("login-success-message")).toHaveText(
			"Your password was changed. Please sign in.",
		);

		await login(page, email, resetPassword, /\/student$/);
		await expect(page.getByTestId("student-dashboard-root")).toBeVisible();
	});
});

function realInfraSmokeConfig(): RealInfraSmokeConfig {
	return {
		appBaseUrl: requiredEnv("PLAYWRIGHT_BASE_URL"),
		studentEmailDomain:
			envValue("SMOKE_EMAIL_DOMAIN") ??
			requiredEnv("PRODUCTION_SMOKE_STUDENT_EMAIL_DOMAIN"),
		teacherEmail:
			envValue("SMOKE_TEACHER_EMAIL") ??
			requiredEnv("PRODUCTION_SMOKE_TEACHER_EMAIL"),
		teacherTemporaryPassword:
			envValue("SMOKE_TEACHER_TEMP_PASSWORD") ??
			envValue("PRODUCTION_SMOKE_TEACHER_TEMP_PASSWORD"),
		teacherPassword:
			envValue("SMOKE_TEACHER_PASSWORD") ??
			requiredEnv("PRODUCTION_SMOKE_TEACHER_PASSWORD"),
	};
}

function requiredEnv(name: string) {
	const value = envValue(name);

	if (!value) {
		throw new Error(`${name} is required for production smoke tests.`);
	}

	return value;
}

function envValue(name: string) {
	return process.env[name]?.trim() || undefined;
}

function smokePassword(prefix: string) {
	return `${prefix}${randomBytes(18).toString("base64url")}aA1!`;
}

async function registerVerifiedStudent(page: Page, email: string) {
	const registrationRequestedAt = Date.now();

	await page.goto("/register");
	await page.getByTestId("register-first-name").fill("Jordan");
	await page.getByTestId("register-last-name").fill("Adebayo");
	await page.getByTestId("register-email").fill(email);
	await page.getByTestId("register-password").fill(studentPassword);
	await page.getByTestId("register-submit").click();

	await expect(page).toHaveURL(/\/login\?registration=verification_sent$/);

	const verificationUrl = await waitForEmailLink({
		email,
		kind: "registration",
		sentAfterMs: registrationRequestedAt,
	});

	await page.goto(appOriginUrl(verificationUrl));
	await expect(page).toHaveURL(/\/login\?verification=verified/);
}

async function login(
	page: Page,
	email: string,
	password: string,
	expectedUrl: RegExp,
) {
	await page.goto("/login");
	await expect(page.getByTestId("login-form")).toHaveAttribute(
		"data-client-ready",
		"true",
	);
	await page.getByTestId("login-email").fill(email);
	await page.getByTestId("login-password").fill(password);
	await page.getByTestId("login-submit").click();
	await expect(page).toHaveURL(expectedUrl);
}

async function loginTeacher(
	page: Page,
	email: string,
	temporaryPassword: string,
	password: string,
) {
	await page.goto("/login");
	await expect(page.getByTestId("login-form")).toHaveAttribute(
		"data-client-ready",
		"true",
	);
	await page.getByTestId("login-email").fill(email);
	await page.getByTestId("login-password").fill(temporaryPassword);
	await page.getByTestId("login-submit").click();

	if (
		await page
			.getByTestId("teacher-first-login-password-form")
			.isVisible({ timeout: 5_000 })
			.catch(() => false)
	) {
		await page.getByTestId("teacher-first-login-new-password").fill(password);
		await page
			.getByTestId("teacher-first-login-confirm-password")
			.fill(password);
		await page.getByTestId("teacher-first-login-password-submit").click();
		await expect(page).toHaveURL(/\/teacher$/);
		return;
	}

	if (
		await page
			.getByTestId("login-error-message")
			.isVisible({ timeout: 1_000 })
			.catch(() => false)
	) {
		await login(page, email, password, /\/teacher$/);
		return;
	}

	await expect(page).toHaveURL(/\/teacher$/);
}

async function publishCaseWithAttachment(page: Page, caseTitle: string) {
	await page.getByTestId("teacher-start-case-button").click();
	await expect(page).toHaveURL(/\/teacher\/cases\/new$/);
	await expect(page.getByTestId("teacher-case-authoring-root")).toBeVisible();

	await page.getByTestId("teacher-case-title").fill(caseTitle);
	await page
		.getByTestId("teacher-case-description")
		.fill("A compact production smoke case for validating the release path.");
	await page.getByTestId("teacher-case-section-presentation").click();
	await page
		.getByTestId("teacher-case-presentation")
		.fill(
			"A 48-year-old clinician reviews a focused endocrine presentation with enough history, exam findings, and laboratory context to support clinical reasoning.",
		);
	await page.getByTestId("teacher-case-section-modelAnswer").click();
	await page
		.getByTestId("teacher-case-model-answer")
		.fill(
			"The model answer explains the likely endocrine diagnosis, supporting findings, safe management priorities, and follow-up considerations.",
		);
	await page.getByTestId("teacher-case-section-resources").click();
	await page
		.getByTestId("teacher-case-lecture-text")
		.fill(
			"Review the endocrine emergency framework, confirm the diagnosis with the available labs, and prioritize immediate stabilization before long-term planning.",
		);
	await page
		.getByTestId("teacher-case-resource-deadline-date")
		.fill(futureDeadlineDate());
	await page.getByTestId("teacher-case-pdf-attachments").setInputFiles({
		name: "production-smoke-material.pdf",
		mimeType: "application/pdf",
		buffer: Buffer.from("%PDF-1.4\n% production smoke placeholder\n%%EOF\n"),
	});
	await expect(page.getByTestId("teacher-case-pdf-list")).toContainText(
		"production-smoke-material.pdf",
	);

	await page.getByTestId("teacher-case-section-cme").click();
	for (const [index, question] of smokeQuestions.entries()) {
		await page.getByTestId("teacher-case-cme-prompt").fill(question.prompt);
		await page.getByTestId("teacher-case-cme-option-0").fill(question.correct);
		await page
			.getByTestId("teacher-case-cme-option-1")
			.fill(question.distractor);

		if (index < smokeQuestions.length - 1) {
			await page.getByTestId("teacher-case-add-cme-question").click();
		}
	}

	await page.getByTestId("teacher-case-section-review").click();
	await expect(page.getByTestId("teacher-case-publish-readiness")).toContainText(
		"Ready to publish",
	);
	await expect(page.getByTestId("teacher-case-header-publish")).toBeEnabled();

	const [publishResponse] = await Promise.all([
		page.waitForResponse(
			(response) =>
				response.url().endsWith("/api/teacher/case-publish") &&
				response.request().method() === "POST",
		),
		page.getByTestId("teacher-case-header-publish").click(),
	]);
	const publishResponseBody = publishResponse.ok()
		? ""
		: await publishResponse.text();

	expect(publishResponse.ok(), publishResponseBody).toBe(true);
	await expect(page).toHaveURL(/\/teacher$/);
}

async function completeStudentCase(page: Page) {
	await expect(page.getByTestId("student-case-flow-root")).toBeVisible();
	await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
		"Case Presentation",
	);

	await page.getByTestId("student-case-continue").click();
	await page.getByTestId("student-case-analysis").fill(validAnalysis());
	await page.getByTestId("student-case-submit-analysis").click();
	await expect(page.getByTestId("student-case-comparison-step")).toBeVisible();

	await page.getByTestId("student-case-continue-to-resources").click();
	await expect(page.getByTestId("student-case-resources-step")).toBeVisible();
	await expect(page.getByTestId("student-case-pdf-attachments")).toContainText(
		"production-smoke-material.pdf",
	);
	await page.getByTestId("student-case-continue-to-quiz").click();
	await expect(page.getByTestId("student-case-quiz-form")).toBeVisible();

	for (const question of smokeQuestions) {
		await page
			.locator('[data-testid^="student-case-quiz-option-"]')
			.filter({ hasText: question.correct })
			.click();
	}

	await expect(page.getByTestId("student-case-quiz-progress")).toHaveText(
		"3 of 3 answered",
	);
	await page.getByTestId("student-case-submit-quiz").click();
	await expect(page.getByTestId("student-case-feedback-step")).toBeVisible();
	await page.getByTestId("student-case-submit-feedback").click();
	await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();
	await expect(page.getByTestId("student-certificate-preview")).toBeVisible();
	await expect(page.getByTestId("student-case-certificate-download")).toHaveAttribute(
		"href",
		/\/student\/certificates\/cert_.*\/download/,
	);
}

async function waitForEmailLink(input: {
		email: string;
		kind: EmailLinkKind;
		sentAfterMs: number;
}) {
	let resolvedLink = "";

	await expect
		.poll(
			async () => {
				resolvedLink = (await findResendLink(input)) ?? "";

				return resolvedLink;
			},
			{
				intervals: [2_000, 5_000, 10_000],
				message: `Waiting for ${input.kind} email link for ${input.email}`,
				timeout: emailLinkTimeoutMs,
			},
		)
		.toMatch(/^(https?:\/\/|\/)/);

	return new URL(resolvedLink, smokeConfig.appBaseUrl).toString();
}

async function findResendLink(input: {
	email: string;
	kind: EmailLinkKind;
	sentAfterMs: number;
}) {
	const subject =
		input.kind === "registration"
			? "Verify your ECCS account"
			: "Reset your ECCS password";
	const pathname =
		input.kind === "registration" ? "/verify-email" : "/reset-password";
	const list = await resendJson<{
		data?: Array<{
			created_at?: string;
			id?: string;
			subject?: string;
			to?: string | string[];
		}>;
	}>("/emails?limit=100");
	const matches = (list.data ?? [])
		.filter((email) => {
			const createdAt = email.created_at ? Date.parse(email.created_at) : 0;

			return (
				email.id &&
				email.subject === subject &&
				createdAt >= input.sentAfterMs - 1_000 &&
				recipients(email.to).includes(input.email)
			);
		})
		.sort(
			(left, right) =>
				Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? ""),
		);

	for (const email of matches) {
		const detail = await resendJson<Record<string, unknown>>(
			`/emails/${email.id}`,
		);
		const data = isRecord(detail.data) ? detail.data : detail;
		const content = [data.text, data.html, JSON.stringify(data)]
			.filter((value): value is string => typeof value === "string")
			.join("\n")
			.replaceAll("&amp;", "&");
		const link = extractLink(content, pathname);

		if (link) {
			return link;
		}
	}

	return null;
}

async function resendJson<T>(path: string): Promise<T> {
	const response = await fetch(`https://api.resend.com${path}`, {
		headers: {
			Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
		},
	});
	const body = (await response.json().catch(() => ({}))) as T;

	if (!response.ok) {
		throw new Error(
			`Resend API ${path} failed with ${response.status}: ${JSON.stringify(body)}`,
		);
	}

	return body;
}

function recipients(value: string | string[] | undefined) {
	return Array.isArray(value) ? value : value ? [value] : [];
}

function extractLink(content: string, pathname: string) {
	const escapedPath = pathname.replaceAll("/", "\\/");
	const match = content.match(
		new RegExp(`https?:\\/\\/[^\\s"'<>]+${escapedPath}[^\\s"'<>]*`, "i"),
	);

	return match?.[0] ?? null;
}

function appOriginUrl(value: string) {
	const target = new URL(value, smokeConfig.appBaseUrl);
	const base = new URL(smokeConfig.appBaseUrl);

	return `${base.origin}${target.pathname}${target.search}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function uniqueStudentEmail(prefix: string) {
	return `eccs-smoke-${prefix}-${uniqueRunId()}@${smokeConfig.studentEmailDomain}`;
}

function uniqueRunId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function futureDeadlineDate() {
	return new Date(Date.now() + 14 * dayInMilliseconds)
		.toISOString()
		.slice(0, 10);
}

function validAnalysis(wordCount = 150) {
	return Array.from(
		{ length: wordCount },
		(_, index) => `clinical${index}`,
	).join(" ");
}

const smokeQuestions = [
	{
		prompt: "Which finding best supports the working endocrine diagnosis?",
		correct: "Persistent hyperglycemia with ketosis",
		distractor: "Normal fasting glucose without symptoms",
	},
	{
		prompt: "Which immediate action is most appropriate?",
		correct: "Prioritize stabilization and targeted lab confirmation",
		distractor: "Delay evaluation until routine follow-up",
	},
	{
		prompt: "Which teaching point should guide ongoing management?",
		correct: "Connect treatment decisions to the objective case findings",
		distractor: "Ignore the documented laboratory pattern",
	},
];
