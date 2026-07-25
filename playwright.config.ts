import { defineConfig } from "@playwright/test";

const e2eHost = process.env.E2E_HOST ?? "127.0.0.1";
const e2ePort = process.env.E2E_PORT ?? "3001";
const baseURL =
	process.env.PLAYWRIGHT_BASE_URL ?? `http://${e2eHost}:${e2ePort}`;
const isMemoryMode = process.env.AUTH_E2E_MODE === "memory";
const isRealInfraSmoke = process.env.REAL_INFRA_SMOKE === "1";
const webServerCommand =
	isMemoryMode ? `bunx next dev -H ${e2eHost} -p ${e2ePort}` : "bun run dev";

const webServerEnv = isMemoryMode
	? {
			AUTH_E2E_MODE: "memory",
			BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? baseURL,
			NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? baseURL,
		}
	: undefined;

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "**/*.e2e.ts",
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: isMemoryMode || isRealInfraSmoke ? 1 : undefined,
	use: {
		baseURL,
		...(isRealInfraSmoke
			? {
					screenshot: "off" as const,
					trace: "off" as const,
					video: "off" as const,
				}
			: {}),
	},
	webServer: process.env.PLAYWRIGHT_BASE_URL || isRealInfraSmoke
		? undefined
		: {
				command: webServerCommand,
				...(webServerEnv ? { env: webServerEnv } : {}),
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			},
});
