import { expect, test } from "@playwright/test";

const shellRoutes = ["/", "/student", "/teacher"];

for (const route of shellRoutes) {
  test(`${route} responds`, async ({ request }) => {
    const response = await request.get(route);

    expect(response.ok()).toBe(true);
  });
}
