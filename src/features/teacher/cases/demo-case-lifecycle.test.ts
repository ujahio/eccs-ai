import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getE2EAuthStore,
	resetE2EAuthStore,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";
import {
	DemoCaseLifecycleControlsDisabledError,
	DynamoDemoTeacherCaseLifecycleRepository,
	InMemoryDemoTeacherCaseLifecycleRepository,
	TeacherCaseDemoLifecycleService,
} from "./demo-case-lifecycle";

vi.mock("server-only", () => ({}));
vi.mock("sst", () => ({ Resource: {} }));

const now = Date.UTC(2026, 6, 9, 8);
const restoredDeadlineAt = Date.UTC(2026, 6, 23, 19, 59, 59, 999);
const teacherProfileId = "teacher-1";

beforeEach(() => {
	resetE2EAuthStore();
});

describe("TeacherCaseDemoLifecycleService", () => {
	it("fails closed when the demo controls flag is disabled", async () => {
		const service = new TeacherCaseDemoLifecycleService(
			new InMemoryDemoTeacherCaseLifecycleRepository(),
			noopScheduler(),
			() => false,
		);

		await expect(
			service.setLifecycle({
				caseId: "active-case",
				lifecycle: "archived",
				now,
				teacherProfileId,
			}),
		).rejects.toBeInstanceOf(DemoCaseLifecycleControlsDisabledError);
	});

	it("archives an active case with past lifecycle dates", async () => {
		seedE2ETeacherCases([
			caseRecord({
				caseId: "active-case",
				deadlineAt: now + 86_400_000,
				deadlineReminderSentAt: now - 1_000,
				lifecycle: "published",
			}),
		]);
		const scheduler = noopScheduler();
		const service = enabledInMemoryService(scheduler);

		await expect(
			service.setLifecycle({
				caseId: "active-case",
				lifecycle: "archived",
				now,
				teacherProfileId,
			}),
		).resolves.toEqual({
			archivedCaseIds: [],
			case: expect.objectContaining({
				archivedAt: now - 1,
				caseId: "active-case",
				deadlineAt: now - 1,
				lifecycle: "archived",
			}),
			changed: true,
		});
		expect(getE2EAuthStore().teacherCases.get("active-case")).toEqual(
			expect.not.objectContaining({ deadlineReminderSentAt: expect.any(Number) }),
		);
		expect(scheduler.scheduleArchive).not.toHaveBeenCalled();
	});

	it("restores an archived case for fourteen days and archives the current active case", async () => {
		seedE2ETeacherCases([
			caseRecord({
				caseId: "current-active-case",
				deadlineAt: now + 86_400_000,
				lifecycle: "published",
			}),
			caseRecord({
				archivedAt: now - 86_400_000,
				caseId: "archived-case",
				deadlineAt: now - 86_400_000,
				deadlineReminderSentAt: now - 90_000_000,
				lifecycle: "archived",
			}),
		]);
		const scheduler = noopScheduler();
		const service = enabledInMemoryService(scheduler);

		await expect(
			service.setLifecycle({
				caseId: "archived-case",
				lifecycle: "published",
				now,
				teacherProfileId,
			}),
		).resolves.toEqual({
			archivedCaseIds: ["current-active-case"],
			case: expect.objectContaining({
				caseId: "archived-case",
				deadlineAt: restoredDeadlineAt,
				lifecycle: "published",
				publishedAt: now,
			}),
			changed: true,
		});
		expect(getE2EAuthStore().teacherCases.get("current-active-case")).toEqual(
			expect.objectContaining({
				archivedAt: now - 1,
				deadlineAt: now - 1,
				lifecycle: "archived",
			}),
		);
		expect(getE2EAuthStore().teacherCases.get("archived-case")).toEqual(
			expect.not.objectContaining({
				archivedAt: expect.any(Number),
				deadlineReminderSentAt: expect.any(Number),
			}),
		);
		expect(scheduler.scheduleArchive).toHaveBeenCalledWith({
			caseId: "archived-case",
			deadlineAt: restoredDeadlineAt,
		});
	});

	it("restores an expired published case as the active case", async () => {
		seedE2ETeacherCases([
			caseRecord({
				caseId: "expired-case",
				deadlineAt: now - 1_000,
				lifecycle: "published",
			}),
		]);
		const scheduler = noopScheduler();
		const service = enabledInMemoryService(scheduler);

		await expect(
			service.setLifecycle({
				caseId: "expired-case",
				lifecycle: "published",
				now,
				teacherProfileId,
			}),
		).resolves.toEqual({
			archivedCaseIds: [],
			case: expect.objectContaining({
				caseId: "expired-case",
				deadlineAt: restoredDeadlineAt,
				lifecycle: "published",
				publishedAt: now,
			}),
			changed: true,
		});
		expect(scheduler.scheduleArchive).toHaveBeenCalledWith({
			caseId: "expired-case",
			deadlineAt: restoredDeadlineAt,
		});
	});

	it("does not restore an archived case when archive scheduling fails", async () => {
		seedE2ETeacherCases([
			caseRecord({
				caseId: "current-active-case",
				deadlineAt: now + 86_400_000,
				lifecycle: "published",
			}),
			caseRecord({
				archivedAt: now - 86_400_000,
				caseId: "archived-case",
				deadlineAt: now - 86_400_000,
				lifecycle: "archived",
			}),
		]);
		const currentActiveBefore = getE2EAuthStore().teacherCases.get(
			"current-active-case",
		);
		const scheduler = {
			scheduleArchive: vi.fn(async () => {
				throw new Error("scheduler unavailable");
			}),
		};
		const service = enabledInMemoryService(scheduler);

		await expect(
			service.setLifecycle({
				caseId: "archived-case",
				lifecycle: "published",
				now,
				teacherProfileId,
			}),
		).rejects.toThrow("scheduler unavailable");
		expect(getE2EAuthStore().teacherCases.get("archived-case")).toEqual(
			expect.objectContaining({
				archivedAt: now - 86_400_000,
				deadlineAt: now - 86_400_000,
				lifecycle: "archived",
			}),
		);
		expect(getE2EAuthStore().teacherCases.get("current-active-case")).toEqual(
			currentActiveBefore,
		);
	});
});

describe("DynamoDemoTeacherCaseLifecycleRepository", () => {
	it("archives an active case and deletes the active-case lock in one transaction", async () => {
		const sentInputs: Array<Record<string, unknown>> = [];
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sentInputs.push(command.input);

				if ("Key" in command.input) {
					return {
						Item: caseRecord({
							caseId: "active-case",
							deadlineAt: now + 86_400_000,
							lifecycle: "published",
						}),
					};
				}

				return {};
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoDemoTeacherCaseLifecycleRepository(
			"TeacherCaseTable",
			documentClient,
		);

		await expect(
			repository.setLifecycle(
				{
					caseId: "active-case",
					lifecycle: "archived",
					now,
					teacherProfileId,
				},
				noopScheduler().scheduleArchive,
			),
		).resolves.toEqual({
			archivedCaseIds: [],
			case: expect.objectContaining({
				archivedAt: now - 1,
				caseId: "active-case",
				deadlineAt: now - 1,
				lifecycle: "archived",
			}),
			changed: true,
		});

		expect(sentInputs[1]).toEqual({
			TransactItems: [
				expect.objectContaining({
					Update: expect.objectContaining({
						Key: { caseId: "active-case" },
						UpdateExpression:
							"SET #lifecycle = :archived, deadlineAt = :pastAt, archivedAt = :pastAt REMOVE deadlineReminderSentAt",
					}),
				}),
				expect.objectContaining({
					Delete: expect.objectContaining({
						Key: { caseId: "teacher-case-active-lock" },
						ConditionExpression:
							"attribute_not_exists(caseId) OR publishedCaseId = :caseId",
					}),
				}),
			],
		});
	});

	it("restores an archived case while archiving the current active case and replacing the lock", async () => {
		const sentInputs: Array<Record<string, unknown>> = [];
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sentInputs.push(command.input);

				if ("Key" in command.input) {
					return {
						Item: caseRecord({
							archivedAt: now - 86_400_000,
							caseId: "archived-case",
							deadlineAt: now - 86_400_000,
							lifecycle: "archived",
						}),
					};
				}

				if ("IndexName" in command.input) {
					return {
						Items: [
							caseRecord({
								caseId: "current-active-case",
								deadlineAt: now + 86_400_000,
								lifecycle: "published",
							}),
						],
					};
				}

				return {};
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoDemoTeacherCaseLifecycleRepository(
			"TeacherCaseTable",
			documentClient,
		);

		await expect(
			repository.setLifecycle(
				{
					caseId: "archived-case",
					lifecycle: "published",
					now,
					teacherProfileId,
				},
				noopScheduler().scheduleArchive,
			),
		).resolves.toEqual({
			archivedCaseIds: ["current-active-case"],
			case: expect.objectContaining({
				caseId: "archived-case",
				deadlineAt: restoredDeadlineAt,
				lifecycle: "published",
				publishedAt: now,
			}),
			changed: true,
		});

		expect(sentInputs[2]).toEqual({
			TransactItems: [
				expect.objectContaining({
					Update: expect.objectContaining({
						Key: { caseId: "current-active-case" },
					}),
				}),
				expect.objectContaining({
					Put: expect.objectContaining({
						Item: expect.objectContaining({
							caseId: "teacher-case-active-lock",
							deadlineAt: restoredDeadlineAt,
							publishedCaseId: "archived-case",
						}),
					}),
				}),
				expect.objectContaining({
					Update: expect.objectContaining({
						Key: { caseId: "archived-case" },
						UpdateExpression:
							"SET #lifecycle = :published, publishedAt = :now, deadlineAt = :deadlineAt REMOVE archivedAt, deadlineReminderSentAt",
					}),
				}),
			],
		});
	});
});

function enabledInMemoryService(scheduler = noopScheduler()) {
	return new TeacherCaseDemoLifecycleService(
		new InMemoryDemoTeacherCaseLifecycleRepository(),
		scheduler,
		() => true,
	);
}

function noopScheduler() {
	return {
		scheduleArchive: vi.fn(async () => {}),
	};
}

function caseRecord({
	archivedAt,
	caseId,
	deadlineAt,
	deadlineReminderSentAt,
	lifecycle,
}: {
	archivedAt?: number;
	caseId: string;
	deadlineAt: number;
	deadlineReminderSentAt?: number;
	lifecycle: "published" | "archived" | "draft";
}) {
	return {
		...(typeof archivedAt === "number" ? { archivedAt } : {}),
		...(typeof deadlineReminderSentAt === "number"
			? { deadlineReminderSentAt }
			: {}),
		caseId,
		completionCount: 0,
		deadlineAt,
		feedbackCount: 0,
		lifecycle,
		publishedAt: now - 2 * 60 * 60 * 1_000,
		recordType: "case" as const,
		teacherProfileId,
		title: caseId,
	};
}
