import {
	CreateScheduleCommand,
	SchedulerClient,
	UpdateScheduleCommand,
	type CreateScheduleCommandInput,
} from "@aws-sdk/client-scheduler";
import "server-only";
import { getActiveCaseArchiveScheduleResources } from "@/lib/aws/resources";

export type ActiveCaseArchiveSchedulePayload = {
	caseId: string;
	deadlineAt: number;
};

export type ActiveCaseArchiveScheduleConfig = {
	groupName: string;
	roleArn: string;
	scheduleName: string;
	targetArn: string;
};

export interface ActiveCaseArchiveScheduler {
	scheduleArchive(payload: ActiveCaseArchiveSchedulePayload): Promise<void>;
}

export class NoopActiveCaseArchiveScheduler
	implements ActiveCaseArchiveScheduler
{
	async scheduleArchive() {}
}

export class EventBridgeActiveCaseArchiveScheduler
	implements ActiveCaseArchiveScheduler
{
	constructor(
		private readonly config: ActiveCaseArchiveScheduleConfig,
		private readonly client: Pick<SchedulerClient, "send"> =
			new SchedulerClient({}),
	) {}

	async scheduleArchive(payload: ActiveCaseArchiveSchedulePayload) {
		const input = scheduleCommandInput(this.config, payload);

		try {
			await this.client.send(new UpdateScheduleCommand(input));
		} catch (error) {
			if (errorName(error) !== "ResourceNotFoundException") {
				throw error;
			}

			await this.client.send(new CreateScheduleCommand(input));
		}
	}
}

export function getActiveCaseArchiveScheduler() {
	if (process.env.AUTH_E2E_MODE === "memory") {
		return new NoopActiveCaseArchiveScheduler();
	}

	return new EventBridgeActiveCaseArchiveScheduler(
		getActiveCaseArchiveScheduleResources(),
	);
}

export function scheduleCommandInput(
	config: ActiveCaseArchiveScheduleConfig,
	payload: ActiveCaseArchiveSchedulePayload,
): CreateScheduleCommandInput {
	return {
		ActionAfterCompletion: "NONE",
		Name: config.scheduleName,
		GroupName: config.groupName,
		ScheduleExpression: scheduleExpressionAt(payload.deadlineAt),
		ScheduleExpressionTimezone: "UTC",
		FlexibleTimeWindow: { Mode: "OFF" },
		State: "ENABLED",
		Target: {
			Arn: config.targetArn,
			RoleArn: config.roleArn,
			Input: JSON.stringify(payload),
		},
	};
}

export function scheduleExpressionAt(deadlineAt: number) {
	if (!Number.isFinite(deadlineAt)) {
		throw new Error("Case archive deadline must be a finite timestamp.");
	}

	const scheduleAt = Math.ceil(deadlineAt / 1_000) * 1_000;
	const isoWithoutMilliseconds = new Date(scheduleAt)
		.toISOString()
		.replace(/\.\d{3}Z$/, "");

	return `at(${isoWithoutMilliseconds})`;
}

function errorName(error: unknown) {
	return typeof error === "object" &&
		error !== null &&
		"name" in error &&
		typeof error.name === "string"
		? error.name
		: null;
}
