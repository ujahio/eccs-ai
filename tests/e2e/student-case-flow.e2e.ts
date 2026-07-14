import {
	expect,
	test,
	type APIRequestContext,
	type Page,
	type Response,
} from "@playwright/test";
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

async function openStudentCaseFlow(page: Page, caseId: string) {
	const response = await page.goto(`/student/cases/${caseId}`);

	expect(response?.ok()).toBe(true);
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

async function answerFeedback(page: Page) {
	await page.getByTestId("student-case-feedback-knowledge-5").click();
	await page.getByTestId("student-case-feedback-interpretation-4").click();
	await page.getByTestId("student-case-feedback-patientCare-5").click();
	await page.getByTestId("student-case-feedback-userExperience-4").click();
	await page
		.getByTestId("student-case-feedback-comment")
		.fill("More cases on complex endocrine presentations would be helpful.");
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

async function waitForStudentCaseResponseReads(
	bodies: string[],
	reads: Array<Promise<void>>,
) {
	let readCount = -1;

	while (readCount !== reads.length) {
		readCount = reads.length;
		await Promise.all(reads);
	}

	return bodies.join("\n");
}

function captureInspectableStudentCaseResponses(page: Page, caseId: string) {
	const bodies: string[] = [];
	const reads: Array<Promise<void>> = [];

	page.on("response", (response) => {
		if (!isInspectableStudentCaseResponse(response, caseId)) {
			return;
		}

		const read = response
			.text()
			.then((body) => {
				bodies.push(body);
			})
			.catch(() => {
				// Redirects and aborted responses do not expose a readable body.
			});

		reads.push(read);
	});

	return {
		async count() {
			await waitForStudentCaseResponseReads(bodies, reads);

			return bodies.length;
		},
		async text() {
			return waitForStudentCaseResponseReads(bodies, reads);
		},
	};
}

function isInspectableStudentCaseResponse(response: Response, caseId: string) {
	if (!["GET", "POST"].includes(response.request().method())) {
		return false;
	}

	const url = new URL(response.url());

	if (url.pathname !== `/student/cases/${caseId}`) {
		return false;
	}

	const contentType = response.headers()["content-type"] ?? "";

	return [
		"application/json",
		"text/html",
		"text/plain",
		"text/x-component",
	].some((inspectableType) => contentType.includes(inspectableType));
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

		await expect(page.getByTestId("student-case-feedback-step")).toBeVisible();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Case Feedback",
		);
		await expect(page.getByTestId("student-case-submit-feedback")).toBeEnabled();
		await answerFeedback(page);
		await page.getByTestId("student-case-submit-feedback").click();
		await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"Certificate",
		);
		await expect(
			page.getByTestId("student-case-certificate-download"),
		).toHaveAttribute("href", /\/student\/certificates\/cert_.*\/download/);
		const certificatePreview = page.getByTestId("student-certificate-preview");

		await expect(certificatePreview).toBeVisible();
		await expect(certificatePreview).toContainText("E-Clinical Case Solutions");
		await expect(certificatePreview).toContainText("Jordan Adebayo");
		await expect(certificatePreview).toContainText(
			"Acute endocrine case review",
		);
		await expect(certificatePreview).toContainText("Completed");
		await expect(certificatePreview).not.toContainText("Certificate ID");
		await expect(certificatePreview).not.toContainText("Credits");
		await expect(certificatePreview).not.toContainText("Partner");
		await expect(certificatePreview).not.toContainText("Issuing");

		const stateResponse = await request.get("/api/e2e/teacher-dashboard/state");
		expect(stateResponse.ok()).toBe(true);
		const state = (await stateResponse.json()) as {
			activeCase?: { feedbackCount?: number };
		};
		expect(state.activeCase?.feedbackCount).toBe(1);
	});

	test("allows students to leave feedback blank and still access the certificate", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-feedback-skip");

		await seedStudentCase(request);
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await reachStudentCaseQuiz(page);
		await answerQuiz(page);
		await page.getByTestId("student-case-submit-quiz").click();

		await expect(page.getByTestId("student-case-feedback-step")).toBeVisible();
		await expect(page.getByTestId("student-case-submit-feedback")).toBeEnabled();
		await page.getByTestId("student-case-submit-feedback").click();
		await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();
		await expect(
			page.getByTestId("student-case-certificate-download"),
		).toHaveAttribute("href", /\/student\/certificates\/cert_.*\/download/);

		const stateResponse = await request.get("/api/e2e/teacher-dashboard/state");
		expect(stateResponse.ok()).toBe(true);
		const state = (await stateResponse.json()) as {
			activeCase?: { feedbackCount?: number };
		};
		expect(state.activeCase?.feedbackCount).toBe(0);
	});

	test("allows students to submit partial feedback and still access the certificate", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-feedback-partial");

		await seedStudentCase(request);
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await startStudentCaseFlow(page);
		await reachStudentCaseQuiz(page);
		await answerQuiz(page);
		await page.getByTestId("student-case-submit-quiz").click();

		await expect(page.getByTestId("student-case-feedback-step")).toBeVisible();
		await page.getByTestId("student-case-feedback-knowledge-5").click();
		await page.getByTestId("student-case-submit-feedback").click();
		await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();
		await expect(
			page.getByTestId("student-case-certificate-download"),
		).toHaveAttribute("href", /\/student\/certificates\/cert_.*\/download/);

		const stateResponse = await request.get("/api/e2e/teacher-dashboard/state");
		expect(stateResponse.ok()).toBe(true);
		const state = (await stateResponse.json()) as {
			activeCase?: { feedbackCount?: number };
		};
		expect(state.activeCase?.feedbackCount).toBe(1);
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

		for (let attempt = 1; attempt <= 2; attempt += 1) {
			await answerQuiz(page, incorrectQuizAnswers());
			await page.getByTestId("student-case-submit-quiz").click();
			const quizStatus = page.getByTestId("student-case-quiz-status");

			await expect(quizStatus).toContainText("did not pass");
			await expect(quizStatus).toHaveClass(/border-warning-gold/);
			await expect(quizStatus).toHaveClass(/bg-\[#fff8e8\]/);
			await expect(
				page.getByTestId("student-case-review-lecture-text"),
			).toBeVisible();
			await expect(page.getByTestId("student-case-quiz-form")).not.toContainText(
				"Incorrect",
			);
			await expect(page.getByTestId("student-case-quiz-progress")).toHaveText(
				"0 of 3 answered",
			);
			await expect(page.getByTestId("student-case-submit-quiz")).toBeDisabled();

			if (attempt === 1) {
				await page.getByTestId("student-case-review-lecture-text").click();
				await expect(page.getByTestId("student-case-resources-step")).toBeVisible();
				await expect(page.getByTestId("student-case-lecture-text")).toContainText(
					"Teaching resources summarize",
				);
				await page.getByTestId("student-case-continue-to-quiz").click();
				await expect(page.getByTestId("student-case-quiz-form")).toBeVisible();
			}
		}

		await page.reload();
		await expect(page.getByTestId("student-case-flow-root")).toBeVisible();
		await reachStudentCaseQuiz(page);
		await answerQuiz(page, incorrectQuizAnswers());
		await page.getByTestId("student-case-submit-quiz").click();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"CME Quiz",
		);
		const thirdAttemptStatus = page.getByTestId("student-case-quiz-status");
		await expect(thirdAttemptStatus).toContainText("did not pass");
		await expect(thirdAttemptStatus).toHaveClass(/border-error-red/);
		await expect(thirdAttemptStatus).toHaveClass(/bg-\[#fff5f5\]/);
		await expect(thirdAttemptStatus).not.toContainText(
			"Review the case presentation",
		);
		await expect(page.getByTestId("student-case-submit-quiz")).toBeDisabled();

		await page.getByTestId("student-case-review-lecture-text").click();
		await expect(page.getByTestId("student-case-resources-step")).toBeVisible();
		await page.getByTestId("student-case-continue-to-quiz").click();
		await expect(page.getByTestId("student-case-flow-heading")).toHaveText(
			"CME Quiz",
		);

		await answerQuiz(page);
		await page.getByTestId("student-case-submit-quiz").click();
		await expect(page.getByTestId("student-case-feedback-step")).toBeVisible();
		await page.getByTestId("student-case-submit-feedback").click();
		await expect(page.getByTestId("student-case-certificate-step")).toBeVisible();
	});

	test("does not expose the CME answer key in student case network payloads", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-case-quiz-answer-key");
		const caseId = "e2e-student-answer-key-boundary-case";
		const capturedResponses = captureInspectableStudentCaseResponses(
			page,
			caseId,
		);

		await seedStudentCase(request, {
			caseId,
			cmeQuestions: [
				{
					id: "network-question-1",
					prompt: "Which finding should guide the next decision?",
					options: [
						{ id: "network-option-1-a", text: "Escalating focal symptoms" },
						{ id: "network-option-1-b", text: "Resolved symptoms alone" },
					],
					correctOptionId: "network-option-1-a",
				},
				{
					id: "network-question-2",
					prompt: "Which action is most appropriate?",
					options: [
						{ id: "network-option-2-a", text: "Review available results" },
						{ id: "network-option-2-b", text: "Ignore the case context" },
					],
					correctOptionId: "network-option-2-a",
				},
				{
					id: "network-question-3",
					prompt: "Which teaching point should be emphasized?",
					options: [
						{ id: "network-option-3-a", text: "Justify decisions with evidence" },
						{ id: "network-option-3-b", text: "Avoid explaining the reasoning" },
					],
					correctOptionId: "network-option-3-a",
				},
			],
		});
		await bootstrapVerifiedStudent(request, email);
		await loginStudent(page, email);
		await openStudentCaseFlow(page, caseId);
		await reachStudentCaseQuiz(page);
		await answerQuiz(page, {
			"network-question-1": "network-option-1-b",
			"network-question-2": "network-option-2-a",
			"network-question-3": "network-option-3-a",
		});

		const failedSubmission = page.waitForResponse(
			(response) =>
				response.request().method() === "POST" &&
				isInspectableStudentCaseResponse(response, caseId),
		);

		await page.getByTestId("student-case-submit-quiz").click();
		await failedSubmission;
		await expect(page.getByTestId("student-case-quiz-status")).toContainText(
			"did not pass",
		);

		expect(await capturedResponses.count()).toBeGreaterThan(0);
		const networkPayload = await capturedResponses.text();
		const studentVisiblePayload = [
			networkPayload,
			await page.content(),
		].join("\n");

		expect(studentVisiblePayload).not.toContain("correctOptionId");
		expect(studentVisiblePayload).not.toContain("correctAnswer");
		expect(studentVisiblePayload).not.toContain("isCorrect");
		await expect(page.getByTestId("student-case-quiz-form")).not.toContainText(
			"Incorrect",
		);
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
		await expect(page.getByTestId("student-case-feedback-step")).toBeVisible();

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
