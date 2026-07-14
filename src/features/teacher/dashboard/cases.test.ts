import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let DynamoTeacherDashboardRepository: typeof import("./cases").DynamoTeacherDashboardRepository;

beforeAll(async () => {
	({ DynamoTeacherDashboardRepository } = await import("./cases"));
});

describe("DynamoTeacherDashboardRepository", () => {
	it("includes dynamically expired published cases with indexed archived cases", async () => {
		const now = Date.UTC(2026, 6, 7);
		const activeCase = {
			caseId: "active-case",
			title: "Active case",
			lifecycle: "published" as const,
			publishedAt: now - 1_000,
			deadlineAt: now + 86_400_000,
			completionCount: 2,
			feedbackCount: 1,
		};
		const expiredPublishedCase = {
			caseId: "expired-published-case",
			title: "Expired published case",
			lifecycle: "published" as const,
			publishedAt: now - 172_800_000,
			deadlineAt: now - 1_000,
			completionCount: 7,
			feedbackCount: 3,
		};
		const archivedCase = {
			caseId: "archived-case",
			title: "Archived case",
			lifecycle: "archived" as const,
			publishedAt: now - 259_200_000,
			deadlineAt: now - 172_800_000,
			archivedAt: now - 172_800_000,
			completionCount: 5,
			feedbackCount: 2,
		};
		const sentInputs: Array<Record<string, unknown>> = [];
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				sentInputs.push(command.input);
				const expressionValues = command.input
					.ExpressionAttributeValues as Record<string, unknown> | undefined;

				if (
					command.input.TableName === "StudentCaseCompletionTable" &&
					expressionValues?.[":caseId"] === "active-case"
				) {
					return { Items: [] };
				}

				if (
					command.input.TableName === "StudentCaseCompletionTable" &&
					expressionValues?.[":caseId"] === "expired-published-case"
				) {
					return { Items: [{ caseId: "expired-published-case" }] };
				}

				if (
					command.input.TableName === "StudentCaseCompletionTable" &&
					expressionValues?.[":caseId"] === "archived-case"
				) {
					return {
						Items: [
							{ caseId: "archived-case", feedback: { submittedAt: now } },
							{ caseId: "archived-case" },
						],
					};
				}

				if (
					command.input.KeyConditionExpression ===
					"#lifecycle = :published AND deadlineAt >= :now"
				) {
					return { Items: [activeCase] };
				}

				if (
					command.input.KeyConditionExpression ===
					"#lifecycle = :published AND deadlineAt < :now"
				) {
					return { Items: [expiredPublishedCase] };
				}

				return { Items: [archivedCase] };
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoTeacherDashboardRepository(
			"TeacherCaseTable",
			"StudentCaseCompletionTable",
			documentClient,
		);

		const summary = await repository.getSummary(now);

		expect(summary.activeCase?.caseId).toBe("active-case");
		expect(summary.activeCase?.completionCount).toBe(0);
		expect(summary.activeCase?.feedbackCount).toBe(0);
		expect(summary.archivedCases.map((caseRecord) => caseRecord.caseId)).toEqual(
			["expired-published-case", "archived-case"],
		);
		expect(summary.archivedCases).toEqual([
			expect.objectContaining({
				caseId: "expired-published-case",
				completionCount: 1,
				feedbackCount: 0,
			}),
			expect.objectContaining({
				caseId: "archived-case",
				completionCount: 2,
				feedbackCount: 1,
			}),
		]);
		expect(sentInputs).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					KeyConditionExpression:
						"#lifecycle = :published AND deadlineAt < :now",
				}),
			]),
		);
	});
});
