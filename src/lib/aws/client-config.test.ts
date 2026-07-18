import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
	vi.unstubAllEnvs();
	process.env = { ...originalEnv };
});

describe("awsClientConfig", () => {
	it("uses AWS_REGION when it is set", async () => {
		vi.stubEnv("AWS_REGION", "me-central-1");
		vi.stubEnv("AWS_DEFAULT_REGION", "us-east-2");

		const { awsClientConfig } = await import("./client-config");

		expect(awsClientConfig()).toEqual({ region: "me-central-1" });
	});

	it("falls back to AWS_DEFAULT_REGION", async () => {
		vi.stubEnv("AWS_DEFAULT_REGION", "us-east-2");

		const { awsClientConfig } = await import("./client-config");

		expect(awsClientConfig()).toEqual({ region: "us-east-2" });
	});

	it("returns an empty config when no region env is set", async () => {
		delete process.env.AWS_REGION;
		delete process.env.AWS_DEFAULT_REGION;

		const { awsClientConfig } = await import("./client-config");

		expect(awsClientConfig()).toEqual({});
	});
});
