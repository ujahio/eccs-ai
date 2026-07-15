import { expect, test, type APIRequestContext } from "@playwright/test";
import {
	bootstrapVerifiedTeacher,
	dayInMilliseconds,
	loginTeacher,
	resetTeacherE2EState,
	uniqueEmail,
} from "./teacher-helpers";

function formatDashboardDate(epochMilliseconds: number) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Asia/Dubai",
	}).format(new Date(epochMilliseconds));
}

async function seedTeacherDashboard(
	request: APIRequestContext,
	activeCase: {
		title: string;
		publishedAt: number;
		deadlineAt: number;
		completionCount: number;
		feedbackCount: number;
	} | null,
	archivedCases: Array<{
		title: string;
		publishedAt: number;
		deadlineAt: number;
		archivedAt: number;
		completionCount: number;
		feedbackCount: number;
	}> = [],
) {
	const completions = [
		...(activeCase
			? completionFixtures({
					caseId: "e2e-active-teacher-dashboard-case",
					completedAt: activeCase.publishedAt,
					completionCount: activeCase.completionCount,
					feedbackCount: activeCase.feedbackCount,
				})
			: []),
		...archivedCases.flatMap((caseRecord, index) =>
			completionFixtures({
				caseId: `e2e-archived-teacher-dashboard-case-${index}`,
				completedAt: caseRecord.archivedAt,
				completionCount: caseRecord.completionCount,
				feedbackCount: caseRecord.feedbackCount,
			}),
		),
	];
	const response = await request.post("/api/e2e/teacher-dashboard/state", {
		data: { activeCase, archivedCases, completions },
	});

	expect(response.ok()).toBe(true);
}

function completionFixtures({
	caseId,
	completedAt,
	completionCount,
	feedbackCount,
}: {
	caseId: string;
	completedAt: number;
	completionCount: number;
	feedbackCount: number;
}) {
	return Array.from({ length: completionCount }, (_, index) => ({
		caseId,
		certificateId: `certificate-${caseId}-${index}`,
		completedAt: completedAt + index,
		feedback:
			index < feedbackCount
				? { ratings: { knowledge: 5 }, submittedAt: completedAt + index }
				: undefined,
		personalAnalysis: `Completed analysis ${index + 1}.`,
		studentDisplayName: `Student ${index + 1}`,
		studentProfileId: `student-${caseId}-${index}`,
	}));
}

test.describe("Teacher dashboard", () => {
	test.beforeAll(async ({ request }) => {
		const response = await request.get("/api/e2e/auth/state");

		expect(response.ok()).toBe(true);
	});

	test.afterEach(async ({ request }) => {
		await resetTeacherE2EState(request);
	});

	test("shows active case details for a verified teacher when a case is seeded", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-dashboard-active");
		const publishedAt = Date.now() - dayInMilliseconds;
		const deadlineAt = Date.now() + 14 * dayInMilliseconds;

		await bootstrapVerifiedTeacher(request, email);
		await seedTeacherDashboard(
			request,
			{
				title: "Acute endocrine case review",
				publishedAt,
				deadlineAt,
				completionCount: 12,
				feedbackCount: 5,
			},
			[
				{
					title: "Cardiac rehabilitation follow-up",
					publishedAt: publishedAt - 28 * dayInMilliseconds,
					deadlineAt: publishedAt - 14 * dayInMilliseconds,
					archivedAt: publishedAt - 14 * dayInMilliseconds,
					completionCount: 18,
					feedbackCount: 9,
				},
				{
					title: "Respiratory complications review",
					publishedAt: publishedAt - 42 * dayInMilliseconds,
					deadlineAt: publishedAt - 30 * dayInMilliseconds,
					archivedAt: publishedAt - 30 * dayInMilliseconds,
					completionCount: 21,
					feedbackCount: 7,
				},
				{
					title: "Metabolic emergency discussion",
					publishedAt: publishedAt - 56 * dayInMilliseconds,
					deadlineAt: publishedAt - 45 * dayInMilliseconds,
					archivedAt: publishedAt - 45 * dayInMilliseconds,
					completionCount: 16,
					feedbackCount: 6,
				},
				{
					title: "Older archived case hidden from dashboard",
					publishedAt: publishedAt - 70 * dayInMilliseconds,
					deadlineAt: publishedAt - 60 * dayInMilliseconds,
					archivedAt: publishedAt - 60 * dayInMilliseconds,
					completionCount: 10,
					feedbackCount: 2,
				},
			],
		);

		await loginTeacher(page, email);
		await expect(page.getByTestId("teacher-dashboard-root")).toBeVisible();
		await expect(page.getByTestId("teacher-start-case-button")).toHaveText(
			"Start a draft case",
		);
		await expect(page.getByTestId("teacher-start-case-button")).toHaveAttribute(
			"href",
			"/teacher/cases/new",
		);
		await expect(page.getByTestId("teacher-active-case-card")).toBeVisible();
		await expect(page.getByTestId("teacher-active-case-title")).toHaveText(
			"Acute endocrine case review",
		);
		await expect(
			page.getByTestId("teacher-active-case-publish-date"),
		).toHaveText(formatDashboardDate(publishedAt));
		await expect(page.getByTestId("teacher-active-case-deadline")).toHaveText(
			formatDashboardDate(deadlineAt),
		);
		await expect(
			page.getByTestId("teacher-active-case-completions"),
		).toHaveText("12");
		await expect(page.getByTestId("teacher-active-case-feedback")).toHaveText(
			"5",
		);
		await expect(page.getByTestId("teacher-archived-case-card")).toHaveCount(3);
		await expect(page.getByTestId("teacher-archived-cases")).toContainText(
			"Cardiac rehabilitation follow-up",
		);
		await expect(page.getByTestId("teacher-archived-cases")).not.toContainText(
			"Older archived case hidden from dashboard",
		);
		await expect(
			page.getByTestId("teacher-dashboard-no-active-case"),
		).toBeHidden();
	});

	test("shows the no-active-case empty state for a verified teacher when no case is seeded", async ({
		page,
		request,
	}) => {
		const email = uniqueEmail("teacher-dashboard-empty");

		await bootstrapVerifiedTeacher(request, email);
		await seedTeacherDashboard(request, null);

		await loginTeacher(page, email);
		await expect(page.getByTestId("teacher-dashboard-root")).toBeVisible();
		await expect(page.getByTestId("teacher-start-case-button")).toHaveText(
			"Start a New Case",
		);
		await expect(page.getByTestId("teacher-start-case-button")).toHaveAttribute(
			"href",
			"/teacher/cases/new",
		);
		await expect(
			page.getByTestId("teacher-dashboard-no-active-case"),
		).toBeVisible();
		await expect(
			page.getByTestId("teacher-dashboard-no-active-case"),
		).toContainText("No active case");
		await expect(page.getByTestId("teacher-active-case-card")).toBeHidden();
	});
});
