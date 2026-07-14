import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
	bootstrapVerifiedTeacher,
	dayInMilliseconds,
	loginTeacher,
	resetTeacherE2EState,
	uniqueEmail,
} from "./teacher-helpers";

const studentPassword = "casework1";

async function seedTeacherCaseReview(request: APIRequestContext) {
	const now = Date.now();
	const response = await request.post("/api/e2e/teacher-dashboard/state", {
		data: {
			activeCase: {
				caseId: "teacher-review-active-case",
				title: "Acute endocrine case review",
				publishedAt: now - dayInMilliseconds,
				deadlineAt: now + 14 * dayInMilliseconds,
				completionCount: 1,
				feedbackCount: 1,
			},
			archivedCases: [
				{
					caseId: "teacher-review-archived-case",
					title: "Archived renal case discussion",
					publishedAt: now - 30 * dayInMilliseconds,
					deadlineAt: now - 16 * dayInMilliseconds,
					archivedAt: now - 16 * dayInMilliseconds,
					completionCount: 1,
					feedbackCount: 0,
				},
			],
			completions: [
				{
					caseId: "teacher-review-active-case",
					certificateId: "certificate-active-review",
					completedAt: now - 2_000,
					analysisSubmittedAt: now - 4_000,
					analysisLockedAt: now - 2_000,
					feedback: {
						futureSuggestions: "Add more comparison with outpatient follow-up.",
						ratings: {
							interpretation: 4,
							knowledge: 5,
						},
						submittedAt: now - 1_000,
					},
					personalAnalysis:
						"Final student analysis comparing endocrine laboratory trends with the clinical presentation.",
					studentDisplayName: "Jordan Adebayo",
					studentProfileId: "student-jordan",
				},
				{
					caseId: "teacher-review-archived-case",
					certificateId: "certificate-archived-review",
					completedAt: now - 17 * dayInMilliseconds,
					personalAnalysis:
						"Archived case final analysis for renal laboratory interpretation.",
					studentDisplayName: "Morgan Lee",
					studentProfileId: "student-morgan",
				},
			],
		},
	});

	expect(response.ok()).toBe(true);
}

async function bootstrapVerifiedStudent(
	request: APIRequestContext,
	email: string,
) {
	const response = await request.post("/api/e2e/auth/state", {
		data: {
			action: "bootstrap_student",
			email,
			emailVerified: true,
			firstName: "Jordan",
			lastName: "Adebayo",
			password: studentPassword,
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
	await page.getByTestId("login-password").fill(studentPassword);
	await page.getByTestId("login-submit").click();
	await expect(page).toHaveURL(/\/student$/);
}

test.describe("Teacher case review", () => {
	test.afterEach(async ({ request }) => {
		await resetTeacherE2EState(request);
	});

	test("lets a teacher review completions, locked analysis, and feedback", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-case-review");

		await bootstrapVerifiedTeacher(request, email);
		await seedTeacherCaseReview(request);
		await loginTeacher(page, email);

		await page.getByTestId("teacher-active-case-review-link").click();
		await expect(page).toHaveURL(/\/teacher\/cases\/teacher-review-active-case$/);
		await expect(page.getByTestId("teacher-case-review-title")).toHaveText(
			"Acute endocrine case review",
		);
		await expect(page.getByTestId("teacher-case-review-student-card")).toHaveCount(
			1,
		);
		await expect(page.getByTestId("teacher-case-review-student-name")).toHaveText(
			"Jordan Adebayo",
		);
		await expect(page.getByTestId("teacher-case-review-analysis-status")).toHaveText(
			"Locked",
		);
		await expect(
			page.getByTestId("teacher-case-review-completion-status"),
		).toHaveText("Complete");
		await expect(page.getByTestId("teacher-case-review-feedback-status")).toHaveText(
			"Left",
		);
		await expect(page.getByTestId("teacher-case-review-root")).not.toContainText(
			"Certificate",
		);

		await page.getByTestId("teacher-case-review-open-response").click();
		await expect(page).toHaveURL(
			/\/teacher\/cases\/teacher-review-active-case\/students\/student-jordan$/,
		);
		await expect(
			page.getByTestId("teacher-student-response-student-name"),
		).toHaveText("Jordan Adebayo");
		await expect(page.getByTestId("teacher-student-response-case-title")).toHaveText(
			"Acute endocrine case review",
		);
		await expect(page.getByTestId("teacher-student-response-analysis")).toContainText(
			"Final student analysis comparing endocrine laboratory trends",
		);
		await expect(
			page.getByTestId("teacher-student-response-completed-at"),
		).toBeVisible();
		await expect(
			page.getByTestId("teacher-student-response-root"),
		).not.toContainText("Certificate");
		await expect(
			page.getByTestId("teacher-student-response-feedback-rating"),
		).toHaveCount(2);
		await expect(
			page.getByTestId("teacher-student-response-feedback-comment"),
		).toContainText("outpatient follow-up");

		await page.getByTestId("teacher-cases-link").click();
		await page.getByTestId("teacher-library-archived-review-link").click();
		await expect(page).toHaveURL(/\/teacher\/cases\/teacher-review-archived-case$/);
		await expect(page.getByTestId("teacher-case-review-title")).toHaveText(
			"Archived renal case discussion",
		);
		await expect(page.getByTestId("teacher-case-review-feedback-status")).toHaveText(
			"Not Left",
		);
	});

	test("rejects student access to teacher case review routes", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("student-teacher-case-review");

		await bootstrapVerifiedStudent(request, email);
		await seedTeacherCaseReview(request);
		await loginStudent(page, email);

		await page.goto("/teacher/cases/teacher-review-active-case");
		await expect(page).toHaveURL(/\/login$/);
	});
});
