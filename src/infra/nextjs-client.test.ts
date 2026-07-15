import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const nextjsCalls: Array<{ args: Record<string, unknown>; name: string }> = [];
	const nextjs = vi.fn(function (
		this: unknown,
		name: string,
		args: Record<string, unknown>,
	) {
		nextjsCalls.push({ args, name });

		return { args, name };
	});

	return {
		auth: {
			userPool: { name: "AuthUserPool" },
			userPoolClient: { name: "AuthUserPoolClient" },
		},
		caseArchive: {
			activeCaseArchiveScheduleArn:
				"arn:aws:scheduler:us-east-2:123456789012:schedule/default/eccs-ai-test-active-case-archive",
			activeCaseArchiveScheduleGroupName: "default",
			activeCaseArchiveScheduleName: "eccs-ai-test-active-case-archive",
			archiveFunction: { arn: "arn:aws:lambda:test:archive-case" },
			archiveSchedulerRoleArn: "arn:aws:iam::123456789012:role/archive",
		},
		caseMaterials: {
			caseMaterialBucket: { name: "CaseMaterialBucket" },
		},
		nextjs,
		nextjsCalls,
		secrets: {
			betterAuthSecret: { name: "BetterAuthSecret" },
			resendApiKey: { name: "ResendApiKey" },
		},
		tables: {
			registrationWorkflowTable: { name: "RegistrationWorkflowTable" },
			studentCaseCompletionTable: { name: "StudentCaseCompletionTable" },
			studentCertificateTable: { name: "StudentCertificateTable" },
			studentQuizAttemptTable: { name: "StudentQuizAttemptTable" },
			teacherCaseTable: { name: "TeacherCaseTable" },
			userProfileTable: { name: "UserProfileTable" },
		},
	};
});

vi.mock("../../infra/auth", () => mocks.auth);
vi.mock("../../infra/case-archive", () => mocks.caseArchive);
vi.mock("../../infra/case-materials", () => mocks.caseMaterials);
vi.mock("../../infra/secrets", () => mocks.secrets);
vi.mock("../../infra/tables", () => mocks.tables);

describe("Next.js infra", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal("sst", {
			aws: {
				Nextjs: mocks.nextjs,
			},
		});
		mocks.nextjs.mockClear();
		mocks.nextjsCalls.length = 0;
	});

	it("allows the app to create or update the active case archive schedule", async () => {
		await import("../../infra/nextjs-client");

		expect(mocks.nextjsCalls).toHaveLength(1);
		expect(mocks.nextjsCalls[0]).toEqual({
			args: expect.objectContaining({
				environment: expect.objectContaining({
					CASE_ARCHIVE_SCHEDULE_GROUP_NAME: "default",
					CASE_ARCHIVE_SCHEDULE_NAME: "eccs-ai-test-active-case-archive",
					CASE_ARCHIVE_SCHEDULER_ROLE_ARN:
						"arn:aws:iam::123456789012:role/archive",
					CASE_ARCHIVE_TARGET_ARN: "arn:aws:lambda:test:archive-case",
				}),
				permissions: [
					{
						actions: ["scheduler:CreateSchedule", "scheduler:UpdateSchedule"],
						resources: [
							"arn:aws:scheduler:us-east-2:123456789012:schedule/default/eccs-ai-test-active-case-archive",
						],
					},
					{
						actions: ["iam:PassRole"],
						resources: ["arn:aws:iam::123456789012:role/archive"],
						conditions: [
							{
								test: "StringEquals",
								variable: "iam:PassedToService",
								values: ["scheduler.amazonaws.com"],
							},
						],
					},
				],
			}),
			name: "eccsfeweb",
		});
	});
});
