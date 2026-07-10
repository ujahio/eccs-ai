import { describe, expect, it, vi } from "vitest";

vi.mock("sst", () => ({ Resource: {} }));

describe("case deadline reminder Lambda handler", () => {
	it("can be imported outside the Next server-only runtime", async () => {
		await expect(import("./deadline-reminders")).resolves.toHaveProperty(
			"handler",
		);
	});
});
