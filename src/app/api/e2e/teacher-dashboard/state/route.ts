import { NextResponse } from "next/server";
import {
	getE2ETeacherCaseStore,
	isE2EMode,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

type E2ETeacherDashboardActiveCase = {
	title: string;
	publishedAt: number;
	deadlineAt: number;
	completionCount: number;
	feedbackCount: number;
};

type E2ETeacherDashboardArchivedCase = E2ETeacherDashboardActiveCase & {
	archivedAt: number;
};

function rejectNonE2EMode() {
	if (isE2EMode()) {
		return null;
	}

	return NextResponse.json(
		{ error: "This endpoint is only available in e2e mode." },
		{ status: 403 },
	);
}

function parseActiveCase(value: unknown): E2ETeacherDashboardActiveCase | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value !== "object") {
		throw new Error("activeCase must be an object or null.");
	}

	const input = value as Record<string, unknown>;
	const title = String(input.title ?? "").trim();
	const publishedAt = Number(input.publishedAt);
	const deadlineAt = Number(input.deadlineAt);
	const completionCount = Number(input.completionCount);
	const feedbackCount = Number(input.feedbackCount);

	if (
		!title ||
		!Number.isFinite(publishedAt) ||
		!Number.isFinite(deadlineAt) ||
		!Number.isInteger(completionCount) ||
		completionCount < 0 ||
		!Number.isInteger(feedbackCount) ||
		feedbackCount < 0
	) {
		throw new Error("activeCase is missing required teacher dashboard fields.");
	}

	return {
		title,
		publishedAt,
		deadlineAt,
		completionCount,
		feedbackCount,
	};
}

function parseArchivedCases(value: unknown): E2ETeacherDashboardArchivedCase[] {
	if (value === null || value === undefined) {
		return [];
	}

	if (!Array.isArray(value)) {
		throw new Error("archivedCases must be an array.");
	}

	return value.map((caseRecord, index) => {
		const parsed = parseActiveCase(caseRecord);
		const archivedAt =
			typeof caseRecord === "object" && caseRecord !== null
				? Number((caseRecord as Record<string, unknown>).archivedAt)
				: Number.NaN;

		if (!parsed || !Number.isFinite(archivedAt)) {
			throw new Error(`archivedCases[${index}] is missing required fields.`);
		}

		return {
			...parsed,
			archivedAt,
		};
	});
}

export async function GET() {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return modeResponse;
	}

	const activeCase =
		getE2ETeacherCaseStore().find(
			(caseRecord) => caseRecord.lifecycle === "published",
		) ?? null;

	return NextResponse.json({ activeCase });
}

export async function POST(request: Request) {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return modeResponse;
	}

	const body = await request.json().catch(() => null);

	try {
		const activeCase = parseActiveCase(body?.activeCase);
		const archivedCases = parseArchivedCases(body?.archivedCases);

		seedE2ETeacherCases(
			[
				activeCase
					? {
							caseId: "e2e-active-teacher-dashboard-case",
							lifecycle: "published" as const,
							...activeCase,
						}
					: null,
				...archivedCases.map((caseRecord, index) => ({
					caseId: `e2e-archived-teacher-dashboard-case-${index}`,
					lifecycle: "archived" as const,
					...caseRecord,
				})),
			].filter((caseRecord) => caseRecord !== null),
		);
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Invalid request." },
			{ status: 400 },
		);
	}

	return NextResponse.json({ activeCase: getE2ETeacherCaseStore()[0] ?? null });
}

export async function DELETE() {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return modeResponse;
	}

	seedE2ETeacherCases([]);

	return NextResponse.json({ reset: true });
}
