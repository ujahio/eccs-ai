import { describe, expect, it, vi } from "vitest";
import {
	EventBridgeActiveCaseArchiveScheduler,
	NoopActiveCaseArchiveScheduler,
	getActiveCaseArchiveScheduler,
	scheduleCommandInput,
	type ActiveCaseArchiveScheduleConfig,
} from "./active-case-archive-scheduler";

vi.mock("server-only", () => ({}));

const config: ActiveCaseArchiveScheduleConfig = {
	groupName: "default",
	roleArn: "arn:aws:iam::123456789012:role/archive-scheduler",
	scheduleName: "eccs-ai-test-active-case-archive",
	targetArn: "arn:aws:lambda:us-east-2:123456789012:function:archive",
};

describe("scheduleCommandInput", () => {
	it("targets the active archive handler with the exact case payload", () => {
		const deadlineAt = Date.UTC(2026, 7, 12, 19, 59, 59, 999);

		expect(
			scheduleCommandInput(config, {
				caseId: "case-1",
				deadlineAt,
			}),
		).toEqual({
			ActionAfterCompletion: "NONE",
			Name: "eccs-ai-test-active-case-archive",
			GroupName: "default",
			ScheduleExpression: "at(2026-08-12T20:00:00)",
			ScheduleExpressionTimezone: "UTC",
			FlexibleTimeWindow: { Mode: "OFF" },
			State: "ENABLED",
			Target: {
				Arn: "arn:aws:lambda:us-east-2:123456789012:function:archive",
				RoleArn: "arn:aws:iam::123456789012:role/archive-scheduler",
				Input: JSON.stringify({
					caseId: "case-1",
					deadlineAt,
				}),
			},
		});
	});
});

describe("EventBridgeActiveCaseArchiveScheduler", () => {
	it("updates the single mutable schedule when it already exists", async () => {
		const sent: Array<{ input: Record<string, unknown>; name: string }> = [];
		const client = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sent.push({ input: command.input, name: command.constructor.name });

				return {};
			}),
		};
		const scheduler = new EventBridgeActiveCaseArchiveScheduler(config, client);

		await scheduler.scheduleArchive({
			caseId: "case-1",
			deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
		});

		expect(sent).toEqual([
			expect.objectContaining({
				name: "UpdateScheduleCommand",
				input: expect.objectContaining({
					Name: "eccs-ai-test-active-case-archive",
					Target: expect.objectContaining({
						Input: JSON.stringify({
							caseId: "case-1",
							deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
						}),
					}),
				}),
			}),
		]);
	});

	it("creates the single mutable schedule when update reports it missing", async () => {
		const sent: string[] = [];
		const client = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sent.push(command.constructor.name);

				if (command.constructor.name === "UpdateScheduleCommand") {
					throw Object.assign(new Error("missing"), {
						name: "ResourceNotFoundException",
					});
				}

				return {};
			}),
		};
		const scheduler = new EventBridgeActiveCaseArchiveScheduler(config, client);

		await scheduler.scheduleArchive({
			caseId: "case-1",
			deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
		});

		expect(sent).toEqual(["UpdateScheduleCommand", "CreateScheduleCommand"]);
	});
});

describe("getActiveCaseArchiveScheduler", () => {
	it("uses the noop scheduler in e2e memory mode", () => {
		vi.stubEnv("AUTH_E2E_MODE", "memory");
		vi.stubEnv("CASE_ARCHIVE_SCHEDULE_NAME", "");
		vi.stubEnv("CASE_ARCHIVE_SCHEDULER_ROLE_ARN", "");
		vi.stubEnv("CASE_ARCHIVE_TARGET_ARN", "");

		expect(getActiveCaseArchiveScheduler()).toBeInstanceOf(
			NoopActiveCaseArchiveScheduler,
		);

		vi.unstubAllEnvs();
	});
});
