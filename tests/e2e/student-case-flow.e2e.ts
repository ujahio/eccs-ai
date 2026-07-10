import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { deadlineAtFromDubaiDate } from "@/features/teacher/case-authoring/schema";

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const password = "casework1";

function uniqueEmail(prefix: string) {
	return `e2e-${prefix}-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}@example.com`;
}

function validAnalysis(wordCount = 150) {
	return Array.from(
		{ length: wordCount },
		(_, index) => `clinical${index}`,
	).join(" ");
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

async function seedStudentCase(
	request: APIRequestContext,
	data?: {
		caseId?: string;
		deadlineAt?: number;
		modelAnswer?: string;
		presentation?: string;
		title?: string;
	},
) {
	const now = Date.now();
	const response = await request.post("/api/e2e/student-dashboard/state", {
		data: {
			activeCase: {
				caseId: data?.caseId ?? "e2e-student-flow-case",
				description:
					"A focused case presentation for students to practice clinical reasoning.",
				modelAnswer:
					data?.modelAnswer ??
					"Teacher model answer explains the likely diagnosis, supporting evidence, and next management step.",
				presentation:
					data?.presentation ??
					"Patient history, presenting symptoms, laboratory findings, and the clinical decision context are described with enough detail for learners to reason carefully.",
				title: data?.title ?? "Acute endocrine case review",
				publishedAt: now - dayInMilliseconds,
				deadlineAt: data?.deadlineAt ?? now + 14 * dayInMilliseconds,
			},
			certificates: [],
		},
	});

	expect(response.ok()).toBe(true);
}

async function startStudentCaseFlow(page: Page) {
	const cta = page.getByTestId("student-active-case-cta");

	await expect(cta).toHaveAttribute(
		"href",
		"/student/cases/e2e-student-flow-case",
	);
	await Promise.all([
		page.waitForURL(/\/student\/cases\/e2e-student-flow-case$/),
		cta.click({ force: true }),
	]);
	await expect(page.getByTestId("student-case-flow-root")).toBeVisible();
}

async function expireBrowserClock(page: Page, deadlineAt: number) {
	await page.evaluate((expiresAt) => {
		Date.now = () => expiresAt + 1;
	}, deadlineAt);
}

test.describe("Student case presentation and analysis flow", () => {
	test.beforeAll(async ({ request }) => {
		const response = await request.get("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test.afterEach(async ({ request }) => {
		const response = await request.delete("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test("submits a valid one-sitting analysis and allows local editing", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-flow");

		await seedStudentCase(request);
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);

		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Case Presentation",
		);
		await expect(page.getByTestId("student-case-flow-root")).not.toContainText(
			"Acute endocrine case review",
		);
		await expect(page.getByTestId("student-case-flow-root")).not.toContainText(
			"A focused case presentation for students to practice clinical reasoning.",
		);
		await expect(page.getByTestId("student-case-presentation")).toContainText(
			"Patient history",
		);
		await page.getByTestId("student-case-continue").click();
		await expect(page.getByTestId("student-case-analysis-form")).toBeVisible();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Personal Analysis",
		);

		await page.getByTestId("student-case-analysis").fill("too short");
		await expect(page.getByTestId("student-case-analysis-word-count")).toHaveText(
			"2 / 700 words",
		);
		await expect(page.getByTestId("student-case-submit-analysis")).toBeDisabled();
		await page.getByTestId("student-case-analysis").fill(validAnalysis(701));
		await expect(page.getByTestId("student-case-analysis-word-count")).toHaveText(
			"701 / 700 words",
		);
		await expect(page.getByTestId("student-case-analysis-validation")).toHaveText(
			"Keep your analysis to 700 words or fewer.",
		);
		await expect(page.getByTestId("student-case-submit-analysis")).toBeDisabled();

		await page.getByTestId("student-case-analysis").fill(validAnalysis());
		await expect(page.getByTestId("student-case-analysis-word-count")).toHaveText(
			"150 / 700 words",
		);
		await page.getByTestId("student-case-submit-analysis").click();
		await expect(page.getByTestId("student-case-comparison-step")).toBeVisible();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Side-By-Side Comparison",
		);
		await expect(page.getByTestId("student-case-submitted-analysis")).toContainText(
			"clinical149",
		);
		await expect(page.getByTestId("student-case-model-answer")).toContainText(
			"Teacher model answer",
		);

		await page.getByTestId("student-case-edit-analysis").click();
		await expect(page.getByTestId("student-case-analysis")).toHaveValue(
			validAnalysis(),
		);

		await page.reload();
		await expect(page.getByTestId("student-case-presentation-step")).toBeVisible();
		await expect(page.getByTestId("student-case-comparison-step")).toHaveCount(0);
	});

	test("blocks direct access after the case deadline", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-expired");
		const caseId = "e2e-expired-student-flow-case";
		const expiredDubaiDeadline = deadlineAtFromDubaiDate("2020-01-01");

		expect(expiredDubaiDeadline).toBe(Date.UTC(2020, 0, 1, 19, 59, 59, 999));
		if (expiredDubaiDeadline === null) {
			throw new Error("Expected valid Dubai deadline fixture.");
		}

		await seedStudentCase(request, {
			caseId,
			deadlineAt: expiredDubaiDeadline,
		});
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);

		const response = await page.goto(`/student/cases/${caseId}`);

		expect(response?.status()).toBe(404);
	});

	test("blocks continue after the deadline passes in an open flow", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-continue-cutoff");
		const deadlineAt = Date.now() + 14 * dayInMilliseconds;

		await seedStudentCase(request, { deadlineAt });
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await expireBrowserClock(page, deadlineAt);

		await expect(page.getByTestId("student-case-flow-message")).toContainText(
			"This case is no longer active.",
		);
		await expect(page.getByTestId("student-case-expired")).toBeVisible();
		await expect(page.getByTestId("student-case-presentation-step")).toHaveCount(0);
	});

	test("blocks submit and edit actions after the deadline passes", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-submit-cutoff");
		const deadlineAt = Date.now() + 14 * dayInMilliseconds;

		await seedStudentCase(request, { deadlineAt });
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await page.getByTestId("student-case-continue").click();
		await page.getByTestId("student-case-analysis").fill(validAnalysis());
		await expireBrowserClock(page, deadlineAt);
		await page.getByTestId("student-case-submit-analysis").click();

		await expect(page.getByTestId("student-case-flow-message")).toContainText(
			"This case is no longer active.",
		);
		await expect(page.getByTestId("student-case-expired")).toBeVisible();

		const nextDeadlineAt = Date.now() + 14 * dayInMilliseconds;
		await seedStudentCase(request, { deadlineAt: nextDeadlineAt });
		await page.goto("/student");
		await startStudentCaseFlow(page);
		await page.getByTestId("student-case-continue").click();
		await page.getByTestId("student-case-analysis").fill(validAnalysis());
		await page.getByTestId("student-case-submit-analysis").click();
		await expect(page.getByTestId("student-case-comparison-step")).toBeVisible();
		await expireBrowserClock(page, nextDeadlineAt);
		await page.getByTestId("student-case-edit-analysis").click();

		await expect(page.getByTestId("student-case-flow-message")).toContainText(
			"This case is no longer active.",
		);
		await expect(page.getByTestId("student-case-expired")).toBeVisible();
	});
});
