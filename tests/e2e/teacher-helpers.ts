import {
	expect,
	type APIRequestContext,
	type Page,
} from "@playwright/test";

export const teacherPassword = "Teacher1!";
export const dayInMilliseconds = 24 * 60 * 60 * 1000;

export function uniqueEmail(prefix: string) {
	return `e2e-${prefix}-${Date.now()}-${Math.random()
		.toString(36)
		.slice(2, 8)}@example.com`;
}

export async function bootstrapVerifiedTeacher(
	request: APIRequestContext,
	email: string,
) {
	const response = await request.post("/api/e2e/auth/state", {
		data: {
			action: "bootstrap_teacher",
			email,
			firstName: "Taylor",
			lastName: "Smith",
			temporaryPassword: teacherPassword,
			emailVerified: true,
			forcePasswordChange: false,
		},
	});

	expect(response.ok()).toBe(true);
}

export async function loginTeacher(page: Page, email: string) {
	await page.goto("/login");
	await expect(page.getByTestId("login-form")).toHaveAttribute(
		"data-client-ready",
		"true",
	);
	await page.getByTestId("login-email").fill(email);
	await page.getByTestId("login-password").fill(teacherPassword);
	await page.getByTestId("login-submit").click();
	await expect(page).toHaveURL(/\/teacher$/);
}

export async function resetTeacherE2EState(request: APIRequestContext) {
	const dashboardResponse = await request.delete(
		"/api/e2e/teacher-dashboard/state",
	);
	expect(dashboardResponse.ok()).toBe(true);

	const authResponse = await request.delete("/api/e2e/auth/state");
	expect(authResponse.ok()).toBe(true);
}
