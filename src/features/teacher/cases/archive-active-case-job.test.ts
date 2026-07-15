import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	archiveActiveCase: vi.fn(async () => ({
		archived: true,
		caseId: "case-1",
		deadlineAt: 123,
	})),
}));

vi.mock("sst", () => ({ Resource: {} }));
vi.mock("./archive-active-case-service", () => ({
	getTeacherCaseArchiveService: () => mocks,
}));

describe("active case archive Lambda handler", () => {
	it("can be imported outside the Next server-only runtime", async () => {
		await expect(import("./archive-active-case-job")).resolves.toHaveProperty(
			"handler",
		);
	});

	it("archives the case from the scheduler payload", async () => {
		const { handler } = await import("./archive-active-case-job");

		const response = await handler({ caseId: "case-1", deadlineAt: 123 });

		expect(mocks.archiveActiveCase).toHaveBeenCalledWith({
			caseId: "case-1",
			deadlineAt: 123,
		});
		expect(JSON.parse(response.body)).toEqual({
			archived: true,
			caseId: "case-1",
			deadlineAt: 123,
		});
	});
});
