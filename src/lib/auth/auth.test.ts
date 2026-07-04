import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const originalEnv = { ...process.env };

afterEach(() => {
	vi.resetModules();
	process.env = { ...originalEnv };
});

describe("auth", () => {
	it("does not resolve linked resources during module import", async () => {
		delete process.env.AUTH_E2E_MODE;

		const authModule = await import("./auth");

		expect(authModule.authHandler).toEqual(expect.any(Function));
		expect(authModule.getAuth).toEqual(expect.any(Function));
	});

	it("configures a DB-less Better Auth route handler", async () => {
		process.env.AUTH_E2E_MODE = "memory";
		process.env.BETTER_AUTH_URL = "http://localhost:3001";

		const { getAuth } = await import("./auth");
		const response = await getAuth().handler(
			new Request("http://localhost:3001/api/auth/ok")
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ ok: true });
	});
});
