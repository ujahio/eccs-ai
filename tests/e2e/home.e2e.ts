import { expect, test } from "@playwright/test";

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
  await expect(page.getByTestId("objectives-heading")).toHaveText("Objectives");
  await expect(
    page.getByTestId("objectives-list")
  ).toContainText("To provide users with needed CMEs");
  await expect(page.getByTestId("workflow-heading")).toHaveText(
    "A static walkthrough of the student learning path"
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
