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
		attachments?: Array<{
			dataUrl: string;
			id: string;
			name: string;
			size: number;
			type: string;
			lastModified: number;
		}>;
		caseId?: string;
		cmeQuestions?: Array<{
			id: string;
			prompt: string;
			options: Array<{ id: string; text: string }>;
			correctOptionId: string;
		}>;
		deadlineAt?: number;
		lectureText?: string;
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
				lectureText:
					data?.lectureText ??
					"Teaching resources summarize the clinical evidence, common diagnostic pitfalls, and next-step management priorities.",
				attachments: data?.attachments ?? [],
				cmeQuestions: data?.cmeQuestions,
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

async function reachStudentCaseQuiz(page: Page) {
	await page.getByTestId("student-case-continue").click();
	await page.getByTestId("student-case-analysis").fill(validAnalysis());
	await page.getByTestId("student-case-submit-analysis").click();
	await page.getByTestId("student-case-continue-to-resources").click();
	await page.getByTestId("student-case-continue-to-quiz").click();
	await expect(page.getByTestId("student-case-quiz-form")).toBeVisible();
}

async function answerQuiz(
	page: Page,
	answers: Record<string, string> = correctQuizAnswers(),
) {
	for (const [questionId, optionId] of Object.entries(answers)) {
		await page
			.getByTestId(`student-case-quiz-option-${questionId}-${optionId}`)
			.click();
	}
}

function correctQuizAnswers() {
	return {
		"question-1": "question-1-a",
		"question-2": "question-2-a",
		"question-3": "question-3-a",
	};
}

function incorrectQuizAnswers() {
	return {
		...correctQuizAnswers(),
		"question-1": "question-1-b",
	};
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
			"Analysis Review",
		);
		await expect(page.getByTestId("student-case-submitted-analysis")).toContainText(
			"clinical149",
		);
		await expect(page.getByTestId("student-case-model-answer")).toContainText(
			"Teacher model answer",
		);
		await expect(page.getByTestId("student-case-review-mode-both")).toHaveAttribute(
			"aria-pressed",
			"true",
		);

		await page.getByTestId("student-case-review-mode-model-answer").click();
		await expect(page.getByTestId("student-case-model-answer-card")).toBeVisible();
		await expect(
			page.getByTestId("student-case-personal-analysis-card"),
		).toHaveCount(0);

		await page.getByTestId("student-case-review-mode-personal-analysis").click();
		await expect(
			page.getByTestId("student-case-personal-analysis-card"),
		).toBeVisible();
		await expect(page.getByTestId("student-case-model-answer-card")).toHaveCount(0);

		await page.getByTestId("student-case-review-mode-both").click();
		await expect(
			page.getByTestId("student-case-personal-analysis-card"),
		).toBeVisible();
		await expect(page.getByTestId("student-case-model-answer-card")).toBeVisible();

		await page.getByTestId("student-case-edit-analysis").click();
		await expect(page.getByTestId("student-case-analysis")).toHaveValue(
			validAnalysis(),
		);
		await page.getByTestId("student-case-analysis").fill(
			`${validAnalysis()} revised`,
		);
		await page.getByTestId("student-case-submit-analysis").click();
		await expect(page.getByTestId("student-case-submitted-analysis")).toContainText(
			"revised",
		);

		await page.reload();
		await expect(page.getByTestId("student-case-presentation-step")).toBeVisible();
		await expect(page.getByTestId("student-case-comparison-step")).toHaveCount(0);
	});

	test("shows teaching resources and signed PDF attachment links after comparison", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-resources");

		await seedStudentCase(request, {
			lectureText:
				"Teaching resources summarize diagnostic criteria, differential clues, and next-step management priorities.",
			attachments: [
				{
					dataUrl: "data:application/pdf;base64,JVBERi0xLjQKJUVPRg==",
					id: "attachment-1",
					name: "teaching-resource.pdf",
					size: 18,
					type: "application/pdf",
					lastModified: 1,
				},
			],
		});
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await page.getByTestId("student-case-continue").click();
		await page.getByTestId("student-case-analysis").fill(validAnalysis());
		await page.getByTestId("student-case-submit-analysis").click();
		await page.getByTestId("student-case-continue-to-resources").click();

		await expect(page.getByTestId("student-case-resources-step")).toBeVisible();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Teaching Resources",
		);
		await expect(page.getByTestId("student-case-lecture-text")).toContainText(
			"Teaching resources summarize diagnostic criteria",
		);
		await expect(page.getByTestId("student-case-pdf-attachments")).toContainText(
			"Case Materials",
		);
		await expect(page.getByTestId("student-case-pdf-attachment-attachment-1"))
			.toContainText("teaching-resource.pdf");
		await expect(
			page.getByTestId("student-case-pdf-inline-attachment-1"),
		).toHaveCount(0);
		await expect(
			page.getByTestId("student-case-pdf-open-attachment-1"),
		).toHaveAttribute("href", /disposition=inline/);
		await expect(
			page.getByTestId("student-case-pdf-open-attachment-1"),
		).toHaveAttribute("target", "_blank");
		await expect(
			page.getByTestId("student-case-pdf-attachment-attachment-1"),
		).not.toContainText("Download");
		await expect(
			page.getByTestId("student-case-pdf-download-attachment-1"),
		).toHaveAttribute("href", /disposition=attachment/);
		await expect(
			page.getByTestId("student-case-pdf-download-attachment-1"),
		).toHaveAttribute("download", "teaching-resource.pdf");
		await expect(
			page.getByTestId("student-case-pdf-download-attachment-1"),
		).toHaveAttribute("aria-label", "Download teaching-resource.pdf");
	});

	test("passes the CME quiz only when all answers are correct", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-quiz-pass");

		await seedStudentCase(request);
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await reachStudentCaseQuiz(page);

		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"CME Quiz",
		);
		await answerQuiz(page);
		await expect(
			page.getByTestId("student-case-quiz-option-question-1-question-1-a"),
		).toHaveAttribute("aria-checked", "true");
		await expect(page.getByTestId("student-case-quiz-progress")).toHaveText(
			"3 of 3 answered",
		);
		await page.getByTestId("student-case-quiz-back-to-resources").click();
		await expect(page.getByTestId("student-case-leave-quiz-dialog")).toBeVisible();
		await page.getByTestId("student-case-stay-on-quiz").click();
		await expect(page.getByTestId("student-case-leave-quiz-dialog")).toHaveCount(
			0,
		);
		await page.getByTestId("student-case-submit-quiz").click();

		await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Certificate",
		);
		await expect(
			page.getByTestId("student-case-certificate-download"),
		).toHaveAttribute("href", /\/student\/certificates\/cert_.*\/download/);
	});

	test("shows failed quiz attempts without per-question correctness and forces review on the third failure", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-quiz-fail");

		await seedStudentCase(request);
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await reachStudentCaseQuiz(page);
		await answerQuiz(page, incorrectQuizAnswers());

		for (let attempt = 1; attempt <= 2; attempt += 1) {
			await page.getByTestId("student-case-submit-quiz").click();
			await expect(page.getByTestId("student-case-quiz-status")).toContainText(
				"did not pass",
			);
			await expect(page.getByTestId("student-case-quiz-form")).not.toContainText(
				"Incorrect",
			);
		}

		await page.getByTestId("student-case-submit-quiz").click();
		await expect(page.getByTestId("student-case-flow-message")).toContainText(
			"Review the case presentation",
		);
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Case Presentation",
		);

		await page.getByTestId("student-case-continue").click();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Analysis Review",
		);
		await page.getByTestId("student-case-continue-to-resources").click();
		await page.getByTestId("student-case-continue-to-quiz").click();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"CME Quiz",
		);

		await answerQuiz(page);
		await page.getByTestId("student-case-submit-quiz").click();
		await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();
	});

	test("rejects quiz submission when the deadline passes before submit", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-quiz-cutoff");

		await seedStudentCase(request);
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await reachStudentCaseQuiz(page);
		await answerQuiz(page);
		await seedStudentCase(request, {
			deadlineAt: Date.now() - dayInMilliseconds,
		});
		await page.getByTestId("student-case-submit-quiz").click();

		await expect(page.getByTestId("student-case-flow-message")).toContainText(
			"This case is no longer active.",
		);
		await expect(page.getByTestId("student-case-expired")).toBeVisible();
		await expect(page.getByTestId("student-case-quiz-form")).toHaveCount(0);
	});

	test("rejects duplicate certificate creation from a second tab", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-quiz-duplicate");

		await seedStudentCase(request);
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await reachStudentCaseQuiz(page);
		await answerQuiz(page);

		const secondPage = await page.context().newPage();
		await secondPage.goto("/student/cases/e2e-student-flow-case");
		await reachStudentCaseQuiz(secondPage);
		await answerQuiz(secondPage);

		await page.getByTestId("student-case-submit-quiz").click();
		await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();

		await secondPage.getByTestId("student-case-submit-quiz").click();
		await expect(
			secondPage.getByTestId("student-case-quiz-status"),
		).toContainText("already been earned");

		await page.goto("/student/certificates");
		await expect(page.getByTestId("student-certificate-history-card")).toHaveCount(
			1,
		);
		await secondPage.close();
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

	test("blocks continuing to teaching resources after the deadline passes", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-resources-cutoff");
		const deadlineAt = Date.now() + 14 * dayInMilliseconds;

		await seedStudentCase(request, { deadlineAt });
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await page.getByTestId("student-case-continue").click();
		await page.getByTestId("student-case-analysis").fill(validAnalysis());
		await page.getByTestId("student-case-submit-analysis").click();
		await expect(page.getByTestId("student-case-comparison-step")).toBeVisible();

		await expireBrowserClock(page, deadlineAt);
		await page.getByTestId("student-case-continue-to-resources").click();

		await expect(page.getByTestId("student-case-flow-message")).toContainText(
			"This case is no longer active.",
		);
		await expect(page.getByTestId("student-case-expired")).toBeVisible();
		await expect(page.getByTestId("student-case-resources-step")).toHaveCount(0);
	});
});
