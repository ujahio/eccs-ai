import { NextResponse } from "next/server";
import {
	getE2ETeacherCaseStore,
	isE2EMode,
	seedE2EStudentCaseCompletions,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";
import { studentCaseCompletionId } from "@/features/student-case-records/ids";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import type { StudentCaseFeedback } from "@/features/case-feedback/feedback";

type E2ETeacherDashboardActiveCase = {
	caseId?: string;
	title: string;
	publishedAt: number;
	deadlineAt: number;
	completionCount: number;
	feedbackCount: number;
};

type E2ETeacherDashboardArchivedCase = E2ETeacherDashboardActiveCase & {
	archivedAt: number;
};

type E2ETeacherDashboardCompletion = {
	analysisLockedAt: number;
	analysisSubmittedAt: number;
	caseId: string;
	certificateId: string;
	completedAt: number;
	feedback?: StudentCaseFeedback;
	personalAnalysis: string;
	studentDisplayName: string;
	studentProfileId: string;
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
	const caseId =
		typeof input.caseId === "string" && input.caseId.trim()
			? input.caseId.trim()
			: undefined;
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
		...(caseId ? { caseId } : {}),
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

function parseCompletions(value: unknown): E2ETeacherDashboardCompletion[] {
	if (value === null || value === undefined) {
		return [];
	}

	if (!Array.isArray(value)) {
		throw new Error("completions must be an array.");
	}

	return value.map((completion, index) => {
		if (typeof completion !== "object" || completion === null) {
			throw new Error(`completions[${index}] must be an object.`);
		}

		const input = completion as Record<string, unknown>;
		const caseId = String(input.caseId ?? "").trim();
		const certificateId = String(input.certificateId ?? "").trim();
		const completedAt = Number(input.completedAt);
		const personalAnalysis = String(input.personalAnalysis ?? "").trim();
		const studentDisplayName = String(input.studentDisplayName ?? "").trim();
		const studentProfileId = String(input.studentProfileId ?? "").trim();
		const analysisSubmittedAt = Number(
			input.analysisSubmittedAt ?? completedAt,
		);
		const analysisLockedAt = Number(input.analysisLockedAt ?? completedAt);

		if (
			!caseId ||
			!certificateId ||
			!Number.isFinite(completedAt) ||
			!Number.isFinite(analysisSubmittedAt) ||
			!Number.isFinite(analysisLockedAt) ||
			!personalAnalysis ||
			!studentDisplayName ||
			!studentProfileId
		) {
			throw new Error(`completions[${index}] is missing required fields.`);
		}

		return {
			analysisLockedAt,
			analysisSubmittedAt,
			caseId,
			certificateId,
			completedAt,
			...(isFeedback(input.feedback) ? { feedback: input.feedback } : {}),
			personalAnalysis,
			studentDisplayName,
			studentProfileId,
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
			(caseRecord) => isActiveTeacherCase(caseRecord, Date.now()),
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
		const completions = parseCompletions(body?.completions);

		seedE2ETeacherCases(
			[
				activeCase
					? {
							caseId:
								activeCase.caseId ?? "e2e-active-teacher-dashboard-case",
							lifecycle: "published" as const,
							...activeCase,
						}
					: null,
				...archivedCases.map((caseRecord, index) => ({
					caseId:
						caseRecord.caseId ??
						`e2e-archived-teacher-dashboard-case-${index}`,
					lifecycle: "archived" as const,
					...caseRecord,
				})),
			].filter((caseRecord) => caseRecord !== null),
		);
		seedE2EStudentCaseCompletions(
			completions.map((completion) => ({
				...completion,
				completionId: studentCaseCompletionId(completion),
			})),
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
	seedE2EStudentCaseCompletions([]);

	return NextResponse.json({ reset: true });
}

function isFeedback(value: unknown): value is StudentCaseFeedback {
	return typeof value === "object" && value !== null;
}
