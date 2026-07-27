import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	QueryCommand,
	TransactWriteCommand,
	type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
	getActiveCaseArchiveScheduler,
	type ActiveCaseArchiveSchedulePayload,
	type ActiveCaseArchiveScheduler,
} from "@/features/teacher/cases/active-case-archive-scheduler";
import { deadlineAtFromDubaiDate } from "@/features/teacher/case-authoring/schema";
import {
	activeCaseLockCaseId,
	activeCaseLockRecordType,
	isActiveTeacherCase,
	teacherCaseRecordType,
	type TeacherCaseLifecycle,
} from "@/features/teacher/cases/case-lifecycle";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { areDemoCaseLifecycleControlsEnabled } from "@/lib/env/demo-case-lifecycle-controls";
import {
	getE2EAuthStore,
	isE2EMode,
} from "@/lib/e2e/in-memory-auth";

export type DemoTeacherCaseLifecycle = "published" | "archived";

export type DemoTeacherCaseLifecycleRecord = {
	archivedAt?: number;
	caseId: string;
	completionCount: number;
	deadlineAt: number;
	feedbackCount: number;
	lifecycle: DemoTeacherCaseLifecycle;
	publishedAt: number;
	title: string;
};

export type SetDemoTeacherCaseLifecycleArgs = {
	caseId: string;
	lifecycle: DemoTeacherCaseLifecycle;
	now: number;
	teacherProfileId: string;
};

export type SetDemoTeacherCaseLifecycleResult = {
	archivedCaseIds: string[];
	case: DemoTeacherCaseLifecycleRecord;
	changed: boolean;
};

export interface DemoTeacherCaseLifecycleRepository {
	setLifecycle(
		args: SetDemoTeacherCaseLifecycleArgs,
		scheduleArchive: ScheduleDemoCaseArchive,
	): Promise<SetDemoTeacherCaseLifecycleResult | null>;
}

type ScheduleDemoCaseArchive = (
	payload: ActiveCaseArchiveSchedulePayload,
) => Promise<void>;

type TransactWriteItem = NonNullable<
	TransactWriteCommandInput["TransactItems"]
>[number];

type StoredTeacherCaseRecord = {
	archivedAt?: number;
	caseId: string;
	completionCount: number;
	deadlineAt: number;
	deadlineReminderSentAt?: number;
	feedbackCount: number;
	lifecycle: TeacherCaseLifecycle;
	publishedAt: number;
	recordType: typeof teacherCaseRecordType;
	teacherProfileId?: string;
	title: string;
};

type ToggleableStoredTeacherCaseRecord = StoredTeacherCaseRecord & {
	lifecycle: DemoTeacherCaseLifecycle;
};

type ActiveCaseLockRecord = {
	caseId: typeof activeCaseLockCaseId;
	deadlineAt: number;
	publishedCaseId: string;
	recordType: typeof activeCaseLockRecordType;
	updatedAt: number;
};

const demoRestoreWindowDays = 14;
const dubaiUtcOffsetMs = 4 * 60 * 60 * 1_000;

export class DemoCaseLifecycleControlsDisabledError extends Error {
	constructor() {
		super("Demo case lifecycle controls are disabled.");
	}
}

export class DemoTeacherCaseNotFoundError extends Error {
	constructor() {
		super("Teacher case not found.");
	}
}

export class DemoCaseLifecycleConflictError extends Error {
	constructor(options?: { cause?: unknown }) {
		super("Case lifecycle changed before the demo toggle completed.", options);
	}
}

export class TeacherCaseDemoLifecycleService {
	constructor(
		private readonly repository: DemoTeacherCaseLifecycleRepository,
		private readonly archiveScheduler: ActiveCaseArchiveScheduler,
		private readonly controlsEnabled = areDemoCaseLifecycleControlsEnabled,
	) {}

	async setLifecycle(args: SetDemoTeacherCaseLifecycleArgs) {
		if (!this.controlsEnabled()) {
			throw new DemoCaseLifecycleControlsDisabledError();
		}

		const result = await this.repository.setLifecycle(
			args,
			this.archiveScheduler.scheduleArchive.bind(this.archiveScheduler),
		);

		if (!result) {
			throw new DemoTeacherCaseNotFoundError();
		}

		return result;
	}
}

export function getTeacherCaseDemoLifecycleService() {
	const repository = isE2EMode()
		? new InMemoryDemoTeacherCaseLifecycleRepository()
		: new DynamoDemoTeacherCaseLifecycleRepository(
				getSessionAuthResources().teacherCaseTableName,
			);

	return new TeacherCaseDemoLifecycleService(
		repository,
		getActiveCaseArchiveScheduler(),
	);
}

export class InMemoryDemoTeacherCaseLifecycleRepository
	implements DemoTeacherCaseLifecycleRepository
{
	async setLifecycle({
		caseId,
		lifecycle,
		now,
		teacherProfileId,
	}: SetDemoTeacherCaseLifecycleArgs, scheduleArchive: ScheduleDemoCaseArchive) {
		const store = getE2EAuthStore();
		const target = store.teacherCases.get(caseId);

		if (!canDemoToggleCase(target, teacherProfileId)) {
			return null;
		}

		if (lifecycle === "archived") {
			return archiveInMemoryCase(target, now);
		}

		return publishInMemoryCase(target, now, teacherProfileId, scheduleArchive);
	}
}

export class DynamoDemoTeacherCaseLifecycleRepository
	implements DemoTeacherCaseLifecycleRepository
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly teacherCaseTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({})),
	) {
		this.documentClient = documentClient;
	}

	async setLifecycle(
		args: SetDemoTeacherCaseLifecycleArgs,
		scheduleArchive: ScheduleDemoCaseArchive,
	) {
		const target = await this.getToggleableCase(
			args.caseId,
			args.teacherProfileId,
		);

		if (!target) {
			return null;
		}

		return args.lifecycle === "archived"
			? this.archiveCase(target, args)
			: this.publishCase(target, args, scheduleArchive);
	}

	private async getToggleableCase(caseId: string, teacherProfileId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.teacherCaseTableName,
				Key: { caseId },
			}),
		);

		const record = response.Item;

		if (!canDemoToggleCase(record, teacherProfileId)) {
			return null;
		}

		return record;
	}

	private async archiveCase(
		target: ToggleableStoredTeacherCaseRecord,
		{ now, teacherProfileId }: SetDemoTeacherCaseLifecycleArgs,
	) {
		if (target.lifecycle === "archived") {
			return lifecycleResult(target, false);
		}

		const pastAt = pastTimestamp(now);
		const transactItems = [
			archiveCaseTransactItem({
				caseId: target.caseId,
				conditionExpression:
					"attribute_exists(caseId) AND #recordType = :caseRecordType AND #lifecycle = :published AND (#teacherProfileId = :teacherProfileId OR attribute_not_exists(#teacherProfileId))",
				now,
				pastAt,
				teacherCaseTableName: this.teacherCaseTableName,
				teacherProfileId,
			}),
		];

		if (isActiveTeacherCase(target, now)) {
			transactItems.push(
				deleteActiveLockTransactItem({
					caseId: target.caseId,
					teacherCaseTableName: this.teacherCaseTableName,
				}),
			);
		}

		try {
			await this.documentClient.send(
				new TransactWriteCommand({ TransactItems: transactItems }),
			);
		} catch (error) {
			if (isConditionalCheckFailed(error)) {
				throw new DemoCaseLifecycleConflictError({ cause: error });
			}

			throw error;
		}

		return lifecycleResult(
			{
				...target,
				archivedAt: pastAt,
				deadlineAt: pastAt,
				lifecycle: "archived",
			},
			true,
		);
	}

	private async publishCase(
		target: ToggleableStoredTeacherCaseRecord,
		{ now, teacherProfileId }: SetDemoTeacherCaseLifecycleArgs,
		scheduleArchive: ScheduleDemoCaseArchive,
	) {
		if (isActiveTeacherCase(target, now)) {
			return lifecycleResult(target, false);
		}

		const activeCases = await this.listActivePublishedCases(now, teacherProfileId);
		const activeCasesToArchive = activeCases.filter(
			(caseRecord) => caseRecord.caseId !== target.caseId,
		);
		const deadlineAt = restoreDeadlineAt(now);
		const pastAt = pastTimestamp(now);
		const restoredCase = restoredCaseRecord(target, now, deadlineAt);

		await scheduleArchive({
			caseId: restoredCase.caseId,
			deadlineAt: restoredCase.deadlineAt,
		});

		const transactItems = [
			...activeCasesToArchive.map((caseRecord) =>
				archiveCaseTransactItem({
					caseId: caseRecord.caseId,
					conditionExpression:
						"attribute_exists(caseId) AND #recordType = :caseRecordType AND #lifecycle = :published AND deadlineAt >= :now AND (#teacherProfileId = :teacherProfileId OR attribute_not_exists(#teacherProfileId))",
					now,
					pastAt,
					teacherCaseTableName: this.teacherCaseTableName,
					teacherProfileId,
				}),
			),
			putActiveLockTransactItem({
				activeCaseIds: activeCasesToArchive.map(
					(caseRecord) => caseRecord.caseId,
				),
				now,
				publishedCase: restoredCase,
				teacherCaseTableName: this.teacherCaseTableName,
			}),
			restoreCaseTransactItem({
				caseId: target.caseId,
				deadlineAt,
				now,
				teacherCaseTableName: this.teacherCaseTableName,
				teacherProfileId,
			}),
		];

		try {
			await this.documentClient.send(
				new TransactWriteCommand({ TransactItems: transactItems }),
			);
		} catch (error) {
			if (isConditionalCheckFailed(error)) {
				throw new DemoCaseLifecycleConflictError({ cause: error });
			}

			throw error;
		}

		return {
			...lifecycleResult(restoredCase, true),
			archivedCaseIds: activeCasesToArchive.map(
				(caseRecord) => caseRecord.caseId,
			),
		};
	}

	private async listActivePublishedCases(
		now: number,
		teacherProfileId: string,
	) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.teacherCaseTableName,
				IndexName: "LifecycleDeadlineIndex",
				KeyConditionExpression: "#lifecycle = :published AND deadlineAt >= :now",
				ExpressionAttributeNames: {
					"#lifecycle": "lifecycle",
				},
				ExpressionAttributeValues: {
					":now": now,
					":published": "published",
				},
				Limit: 10,
			}),
		);

		return (response.Items ?? []).filter(
			(record): record is ToggleableStoredTeacherCaseRecord =>
				canDemoToggleCase(record, teacherProfileId) &&
				isActiveTeacherCase(record, now),
		);
	}
}

function archiveInMemoryCase(
	target: ToggleableStoredTeacherCaseRecord,
	now: number,
) {
	if (target.lifecycle === "archived") {
		return lifecycleResult(target, false);
	}

	const pastAt = pastTimestamp(now);
	const record = archivedDemoCaseRecord(target, pastAt);

	getE2EAuthStore().teacherCases.set(target.caseId, record);

	return lifecycleResult(record, true);
}

async function publishInMemoryCase(
	target: ToggleableStoredTeacherCaseRecord,
	now: number,
	teacherProfileId: string,
	scheduleArchive: ScheduleDemoCaseArchive,
) {
	if (isActiveTeacherCase(target, now)) {
		return lifecycleResult(target, false);
	}

	const store = getE2EAuthStore();
	const pastAt = pastTimestamp(now);
	const activeCasesToArchive = Array.from(store.teacherCases.values()).filter(
		(caseRecord): caseRecord is ToggleableStoredTeacherCaseRecord =>
			caseRecord.caseId !== target.caseId &&
			canDemoToggleCase(caseRecord, teacherProfileId) &&
			isActiveTeacherCase(caseRecord, now),
	);
	const restoredCase = restoredCaseRecord(
		target,
		now,
		restoreDeadlineAt(now),
	);

	await scheduleArchive({
		caseId: restoredCase.caseId,
		deadlineAt: restoredCase.deadlineAt,
	});

	for (const caseRecord of activeCasesToArchive) {
		store.teacherCases.set(
			caseRecord.caseId,
			archivedDemoCaseRecord(caseRecord, pastAt),
		);
	}

	store.teacherCases.set(target.caseId, restoredCase);

	return {
		...lifecycleResult(restoredCase, true),
		archivedCaseIds: activeCasesToArchive.map(
			(caseRecord) => caseRecord.caseId,
		),
	};
}

function archivedDemoCaseRecord(
	caseRecord: ToggleableStoredTeacherCaseRecord,
	archivedAt: number,
): ToggleableStoredTeacherCaseRecord {
	const {
		deadlineReminderSentAt: _deadlineReminderSentAt,
		...record
	} = {
		...caseRecord,
		archivedAt,
		deadlineAt: archivedAt,
		lifecycle: "archived" as const,
	};

	return record;
}

function archiveCaseTransactItem({
	caseId,
	conditionExpression,
	now,
	pastAt,
	teacherCaseTableName,
	teacherProfileId,
}: {
	caseId: string;
	conditionExpression: string;
	now: number;
	pastAt: number;
	teacherCaseTableName: string;
	teacherProfileId: string;
}): TransactWriteItem {
	const expressionAttributeValues: Record<string, unknown> = {
		":archived": "archived",
		":caseRecordType": teacherCaseRecordType,
		":pastAt": pastAt,
		":published": "published",
		":teacherProfileId": teacherProfileId,
	};

	if (conditionExpression.includes(":now")) {
		expressionAttributeValues[":now"] = now;
	}

	return {
		Update: {
			TableName: teacherCaseTableName,
			Key: { caseId },
			UpdateExpression:
				"SET #lifecycle = :archived, deadlineAt = :pastAt, archivedAt = :pastAt REMOVE deadlineReminderSentAt",
			ConditionExpression: conditionExpression,
			ExpressionAttributeNames: {
				"#lifecycle": "lifecycle",
				"#recordType": "recordType",
				"#teacherProfileId": "teacherProfileId",
			},
			ExpressionAttributeValues: expressionAttributeValues,
		},
	};
}

function deleteActiveLockTransactItem({
	caseId,
	teacherCaseTableName,
}: {
	caseId: string;
	teacherCaseTableName: string;
}): TransactWriteItem {
	return {
		Delete: {
			TableName: teacherCaseTableName,
			Key: { caseId: activeCaseLockCaseId },
			ConditionExpression:
				"attribute_not_exists(caseId) OR publishedCaseId = :caseId",
			ExpressionAttributeValues: {
				":caseId": caseId,
			},
		},
	};
}

function putActiveLockTransactItem({
	activeCaseIds,
	now,
	publishedCase,
	teacherCaseTableName,
}: {
	activeCaseIds: string[];
	now: number;
	publishedCase: DemoTeacherCaseLifecycleRecord;
	teacherCaseTableName: string;
}): TransactWriteItem {
	const lockConditionValues = activeCaseIds.reduce<Record<string, unknown>>(
		(values, caseId, index) => ({
			...values,
			[`:activeCaseId${index}`]: caseId,
		}),
		{},
	);
	const activeCaseLockConditions = activeCaseIds.map(
		(_caseId, index) => `publishedCaseId = :activeCaseId${index}`,
	);
	const conditionParts = [
		"attribute_not_exists(caseId)",
		"deadlineAt < :now",
		"publishedCaseId = :targetCaseId",
		...activeCaseLockConditions,
	];

	return {
		Put: {
			TableName: teacherCaseTableName,
			Item: activeCaseLockRecord(publishedCase, now),
			ConditionExpression: conditionParts.join(" OR "),
			ExpressionAttributeValues: {
				...lockConditionValues,
				":now": now,
				":targetCaseId": publishedCase.caseId,
			},
		},
	};
}

function restoreCaseTransactItem({
	caseId,
	deadlineAt,
	now,
	teacherCaseTableName,
	teacherProfileId,
}: {
	caseId: string;
	deadlineAt: number;
	now: number;
	teacherCaseTableName: string;
	teacherProfileId: string;
}): TransactWriteItem {
	return {
		Update: {
			TableName: teacherCaseTableName,
			Key: { caseId },
			UpdateExpression:
				"SET #lifecycle = :published, publishedAt = :now, deadlineAt = :deadlineAt REMOVE archivedAt, deadlineReminderSentAt",
			ConditionExpression:
				"attribute_exists(caseId) AND #recordType = :caseRecordType AND (#teacherProfileId = :teacherProfileId OR attribute_not_exists(#teacherProfileId)) AND (#lifecycle = :archived OR (#lifecycle = :published AND deadlineAt < :now))",
			ExpressionAttributeNames: {
				"#lifecycle": "lifecycle",
				"#recordType": "recordType",
				"#teacherProfileId": "teacherProfileId",
			},
			ExpressionAttributeValues: {
				":archived": "archived",
				":caseRecordType": teacherCaseRecordType,
				":deadlineAt": deadlineAt,
				":now": now,
				":published": "published",
				":teacherProfileId": teacherProfileId,
			},
		},
	};
}

function restoredCaseRecord(
	target: ToggleableStoredTeacherCaseRecord,
	now: number,
	deadlineAt: number,
): ToggleableStoredTeacherCaseRecord {
	const {
		archivedAt: _archivedAt,
		deadlineReminderSentAt: _deadlineReminderSentAt,
		...restored
	} = target;

	return {
		...restored,
		deadlineAt,
		lifecycle: "published",
		publishedAt: now,
	};
}

function activeCaseLockRecord(
	record: DemoTeacherCaseLifecycleRecord,
	now: number,
): ActiveCaseLockRecord {
	return {
		caseId: activeCaseLockCaseId,
		deadlineAt: record.deadlineAt,
		publishedCaseId: record.caseId,
		recordType: activeCaseLockRecordType,
		updatedAt: now,
	};
}

function canDemoToggleCase(
	record: unknown,
	teacherProfileId: string,
): record is ToggleableStoredTeacherCaseRecord {
	return (
		isStoredTeacherCaseRecord(record) &&
		record.lifecycle !== "draft" &&
		(!record.teacherProfileId || record.teacherProfileId === teacherProfileId)
	);
}

function isStoredTeacherCaseRecord(
	record: unknown,
): record is StoredTeacherCaseRecord {
	if (typeof record !== "object" || record === null) {
		return false;
	}

	const candidate = record as Partial<StoredTeacherCaseRecord>;

	return (
		candidate.recordType === teacherCaseRecordType &&
		(candidate.lifecycle === "published" ||
			candidate.lifecycle === "archived" ||
			candidate.lifecycle === "draft") &&
		typeof candidate.caseId === "string" &&
		typeof candidate.deadlineAt === "number" &&
		typeof candidate.publishedAt === "number" &&
		typeof candidate.title === "string"
	);
}

function lifecycleResult(
	record: ToggleableStoredTeacherCaseRecord,
	changed: boolean,
): SetDemoTeacherCaseLifecycleResult {
	return {
		archivedCaseIds: [],
		case: {
			...(typeof record.archivedAt === "number"
				? { archivedAt: record.archivedAt }
				: {}),
			caseId: record.caseId,
			completionCount: record.completionCount,
			deadlineAt: record.deadlineAt,
			feedbackCount: record.feedbackCount,
			lifecycle: record.lifecycle,
			publishedAt: record.publishedAt,
			title: record.title,
		},
		changed,
	};
}

function pastTimestamp(now: number) {
	return now - 1;
}

function restoreDeadlineAt(now: number) {
	const restoredDeadlineAt = deadlineAtFromDubaiDate(
		dubaiDateStringDaysFrom(now, demoRestoreWindowDays),
	);

	if (restoredDeadlineAt === null) {
		throw new Error("Demo case restore deadline could not be calculated.");
	}

	return restoredDeadlineAt;
}

function dubaiDateStringDaysFrom(now: number, days: number) {
	const dubaiNow = new Date(now + dubaiUtcOffsetMs);
	const targetDate = new Date(
		Date.UTC(
			dubaiNow.getUTCFullYear(),
			dubaiNow.getUTCMonth(),
			dubaiNow.getUTCDate() + days,
		),
	);

	return [
		targetDate.getUTCFullYear().toString().padStart(4, "0"),
		(targetDate.getUTCMonth() + 1).toString().padStart(2, "0"),
		targetDate.getUTCDate().toString().padStart(2, "0"),
	].join("-");
}

function isConditionalCheckFailed(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const errorName =
		"name" in error && typeof error.name === "string" ? error.name : null;

	if (errorName === "ConditionalCheckFailedException") {
		return true;
	}

	if (errorName !== "TransactionCanceledException") {
		return false;
	}

	if (!("CancellationReasons" in error)) {
		return true;
	}

	const reasons = error.CancellationReasons;

	return (
		Array.isArray(reasons) &&
		reasons.some(
			(reason) =>
				typeof reason === "object" &&
				reason !== null &&
				"Code" in reason &&
				reason.Code === "ConditionalCheckFailed",
		)
	);
}
