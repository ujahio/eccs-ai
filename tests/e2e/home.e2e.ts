import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from "@playwright/test";
import {
  bootstrapVerifiedTeacher,
  loginTeacher,
  resetTeacherE2EState,
  uniqueEmail as uniqueTeacherEmail
} from "./teacher-helpers";

const password = "casework1";

function uniqueEmail(prefix: string) {
  return `e2e-${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

async function bootstrapVerifiedStudent(
  request: APIRequestContext,
  email: string
) {
  const response = await request.post("/api/e2e/auth/state", {
    data: {
      action: "bootstrap_student",
      email,
      firstName: "Jordan",
      lastName: "Adebayo",
      password,
      emailVerified: true
    }
  });

  expect(response.ok()).toBe(true);
}

async function loginStudent(page: Page, email: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/student$/);
}

async function resetE2EAuthState(request: APIRequestContext) {
  const response = await request.delete("/api/e2e/auth/state");

  expect(response.ok()).toBe(true);
}

const shellRoutes = [
  "/",
  "/student",
  "/teacher",
  "/login",
  "/register",
  "/faculty"
];

for (const route of shellRoutes) {
  test(`${route} responds`, async ({ request }) => {
    const response = await request.get(route);

    expect(response.ok()).toBe(true);
  });
}

test("public marketing page shows ECCS content and entry navigation", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByTestId("home-heading")).toHaveText(
    "Welcome to e-Clinical Cases Solutions"
  );
  await expect(
    page.getByTestId("home-intro-copy")
  ).toContainText("category 1 CME in laboratory medicine");
  await expect(page.getByTestId("public-nav-login")).toHaveText("Log in");
  await expect(page.getByTestId("public-nav-register")).toHaveText(
    "Get started"
  );
  await expect(page.getByTestId("objectives-heading")).toHaveText("Objectives");
  await expect(
    page.getByTestId("objectives-list")
  ).toContainText("To provide users with needed CMEs");
  await expect(page.getByTestId("workflow-heading")).toHaveText(
    "A static walkthrough of the student learning path"
  );
  await expect(page.getByTestId("home-hero-get-started")).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(page.getByTestId("objectives-get-started")).toHaveAttribute(
    "href",
    "/register"
  );

  await page.getByTestId("home-hero-get-started").click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByTestId("register-submit")).toHaveText("Continue");

  await page.getByTestId("register-login-link").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("login-heading")).toHaveText(
    "Sign in to Your Account"
  );
});

test("faculty page shows the standalone faculty profile", async ({ page }) => {
  await page.goto("/faculty");

  await expect(page.getByTestId("faculty-heading")).toHaveText(
    "Faculty Profile"
  );
  await expect(
    page.getByTestId("faculty-profile-copy")
  ).toContainText("Dr Emmanuel Abu");
  await expect(
    page.getByTestId("faculty-profile-copy")
  ).toContainText("clinical laboratory medicine spanning over 20 years");
});

test("public mobile header uses the compact navigation menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/faculty");

  await expect(page.getByTestId("mobile-nav-toggle")).toBeVisible();
  await expect(page.getByTestId("mobile-nav-login")).toBeHidden();
  await expect(page.getByTestId("mobile-nav-register")).toBeHidden();

  await page.getByTestId("mobile-nav-toggle").click();
  await expect(page.getByTestId("mobile-nav-login")).toBeVisible();
  await expect(page.getByTestId("mobile-nav-register")).toBeVisible();
});

test("logged-in student sees dashboard and account affordances on public marketing pages", async ({
  page,
  request
}) => {
  const email = uniqueEmail("public-nav-student");

  await resetE2EAuthState(request);
  await bootstrapVerifiedStudent(request, email);
  await loginStudent(page, email);

  await page.goto("/");

  await expect(page.getByTestId("public-nav-student-dashboard")).toHaveText(
    "Continue Learning"
  );
  await expect(page.getByTestId("public-nav-student-dashboard")).toHaveAttribute(
    "href",
    "/student"
  );
  await expect(page.getByTestId("student-account-menu-trigger")).toHaveAttribute(
    "aria-label",
    "Open menu for Jordan Adebayo"
  );
  await expect(page.getByTestId("student-account-menu-trigger")).toContainText(
    "Jordan A."
  );
  await expect(page.getByTestId("public-nav-login")).toHaveCount(0);
  await expect(page.getByTestId("public-nav-register")).toHaveCount(0);
  await expect(page.getByTestId("home-hero-get-started")).toHaveText(
    "Continue Learning"
  );
  await expect(page.getByTestId("home-hero-get-started")).toHaveAttribute(
    "href",
    "/student"
  );
  await expect(page.getByTestId("objectives-get-started")).toHaveText(
    "Continue Learning"
  );
  await expect(page.getByTestId("objectives-get-started")).toHaveAttribute(
    "href",
    "/student"
  );

  await page.getByTestId("public-nav-student-dashboard").click();
  await expect(page).toHaveURL(/\/student$/);

  await page.goto("/faculty");

  await expect(page.getByTestId("public-nav-student-dashboard")).toBeVisible();
  const accountMenuTrigger = page.getByTestId("student-account-menu-trigger");

  await expect(accountMenuTrigger).toBeVisible();
  await accountMenuTrigger.click();
  await expect(page.getByTestId("student-account-menu-profile")).toBeVisible();

  await page.getByTestId("student-account-menu-profile").click();
  await expect(page).toHaveURL(/\/student\/profile$/);

  await page.getByTestId("student-shell-logo").click();
  await expect(page).toHaveURL(/\/student$/);

  await resetE2EAuthState(request);
});

test("logged-in student mobile menu prioritizes learning and account links", async ({
  page,
  request
}) => {
  const email = uniqueEmail("public-nav-student-mobile");

  await resetE2EAuthState(request);
  await bootstrapVerifiedStudent(request, email);
  await loginStudent(page, email);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const accountMenuTrigger = page.getByTestId("student-account-menu-trigger");

  await expect(accountMenuTrigger).toBeVisible();
  await accountMenuTrigger.click();
  await expect(page.getByTestId("student-account-menu")).toContainText(
    "Signed In"
  );
  await expect(page.getByTestId("student-account-menu")).toContainText(
    "Jordan A."
  );
  await expect(page.getByTestId("student-account-menu-dashboard")).toHaveText(
    "Continue Learning"
  );
  await expect(
    page.getByTestId("student-account-menu-dashboard")
  ).toHaveAttribute("href", "/student");
  await expect(page.getByTestId("student-account-menu-profile")).toBeVisible();

  await resetE2EAuthState(request);
});

test("logged-in teacher sees role dashboard and account affordances on public marketing pages", async ({
  page,
  request
}) => {
  const email = uniqueTeacherEmail("public-nav-teacher");

  await resetTeacherE2EState(request);
  await bootstrapVerifiedTeacher(request, email);
  await loginTeacher(page, email);

  await page.goto("/");

  await expect(page.getByTestId("public-nav-teacher-dashboard")).toHaveText(
    "Teacher Dashboard"
  );
  await expect(page.getByTestId("public-nav-teacher-dashboard")).toHaveAttribute(
    "href",
    "/teacher"
  );
  await expect(page.getByTestId("teacher-account-menu-trigger")).toHaveAttribute(
    "aria-label",
    "Open menu for Taylor Smith"
  );
  await expect(page.getByTestId("teacher-account-menu-trigger")).toContainText(
    "Taylor S."
  );
  await expect(page.getByTestId("home-hero-get-started")).toHaveText(
    "Teacher Dashboard"
  );
  await expect(page.getByTestId("home-hero-get-started")).toHaveAttribute(
    "href",
    "/teacher"
  );
  await expect(page.getByTestId("objectives-get-started")).toHaveText(
    "Teacher Dashboard"
  );
  await expect(page.getByTestId("objectives-get-started")).toHaveAttribute(
    "href",
    "/teacher"
  );
  await expect(page.getByTestId("public-nav-login")).toHaveCount(0);
  await expect(page.getByTestId("public-nav-register")).toHaveCount(0);

  await page.goto("/faculty");

  const accountMenuTrigger = page.getByTestId("teacher-account-menu-trigger");

  await expect(accountMenuTrigger).toBeVisible();
  await accountMenuTrigger.click();
  await expect(page.getByTestId("teacher-account-menu-profile")).toBeVisible();

  await page.getByTestId("teacher-account-menu-profile").click();
  await expect(page).toHaveURL(/\/teacher\/profile$/);

  await page.getByTestId("teacher-shell-logo").click();
  await expect(page).toHaveURL(/\/teacher$/);

  await resetTeacherE2EState(request);
});
