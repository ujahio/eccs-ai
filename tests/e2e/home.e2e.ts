import { expect, test } from "@playwright/test";

test("home page responds", async ({ request }) => {
  const response = await request.get("/");

  expect(response.ok()).toBe(true);
});
