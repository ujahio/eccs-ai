import { NextResponse } from "next/server";
import {
	getE2EStudentCertificateStore,
	getE2ETeacherCaseStore,
	seedE2EStudentCertificates,
	seedE2ETeacherCases,
	type E2EStudentCertificateRecord,
} from "@/lib/e2e/in-memory-auth";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { rejectNonE2EMode } from "@/lib/e2e/route-helpers";

type E2EStudentDashboardActiveCase = {
	title: string;
	publishedAt: number;
	deadlineAt: number;
};

function parseActiveCase(value: unknown): E2EStudentDashboardActiveCase | null {
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

	if (!title || !Number.isFinite(publishedAt) || !Number.isFinite(deadlineAt)) {
		throw new Error("activeCase is missing required student dashboard fields.");
	}

	return {
		title,
		publishedAt,
		deadlineAt,
	};
}

function parseCertificates(value: unknown): E2EStudentCertificateRecord[] {
	if (value === null || value === undefined) {
		return [];
	}

	if (!Array.isArray(value)) {
		throw new Error("certificates must be an array.");
	}

	return value.map((certificate, index) => {
		if (typeof certificate !== "object" || certificate === null) {
			throw new Error(`certificates[${index}] must be an object.`);
		}

		const input = certificate as Record<string, unknown>;
		const certificateId = String(input.certificateId ?? "").trim();
		const caseId = String(input.caseId ?? "").trim();
		const caseTitle = String(input.caseTitle ?? "").trim();
		const completedAt = Number(input.completedAt);
		const studentDisplayName = String(input.studentDisplayName ?? "").trim();
		const studentProfileId = String(input.studentProfileId ?? "").trim();

		if (
			!certificateId ||
			!caseId ||
			!caseTitle ||
			!Number.isFinite(completedAt) ||
			!studentDisplayName ||
			!studentProfileId
		) {
			throw new Error(`certificates[${index}] is missing required fields.`);
		}

		return {
			certificateId,
			caseId,
			caseTitle,
			completedAt,
			studentDisplayName,
			studentProfileId,
		};
	});
}

export async function GET(request: Request) {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return modeResponse;
	}

	const studentProfileId = new URL(request.url).searchParams.get("studentProfileId");
	const activeCase =
		getE2ETeacherCaseStore().find((caseRecord) =>
			isActiveTeacherCase(caseRecord, Date.now()),
		) ?? null;
	const certificates = studentProfileId
		? getE2EStudentCertificateStore(studentProfileId)
		: [];

	return NextResponse.json({ activeCase, certificates });
}

export async function POST(request: Request) {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return modeResponse;
	}

	const body = await request.json().catch(() => null);

	try {
		const activeCase = parseActiveCase(body?.activeCase);
		const certificates = parseCertificates(body?.certificates);

		seedE2ETeacherCases(
			activeCase
				? [
						{
							caseId: "e2e-active-student-dashboard-case",
							lifecycle: "published" as const,
							completionCount: 0,
							feedbackCount: 0,
							...activeCase,
						},
					]
				: [],
		);
		seedE2EStudentCertificates(certificates);
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Invalid request." },
			{ status: 400 },
		);
	}

	return NextResponse.json({ seeded: true });
}

export async function DELETE() {
	const modeResponse = rejectNonE2EMode();

	if (modeResponse) {
		return modeResponse;
	}

	seedE2ETeacherCases([]);
	seedE2EStudentCertificates([]);

	return NextResponse.json({ reset: true });
}
