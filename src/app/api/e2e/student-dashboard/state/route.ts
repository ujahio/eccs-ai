import { NextResponse } from "next/server";
import {
	getE2EStudentCertificateStore,
	getE2ETeacherCaseStore,
	seedE2EStudentCertificates,
	seedE2ETeacherCases,
	type E2EStudentCertificateRecord,
} from "@/lib/e2e/in-memory-auth";
import type {
	CaseDraft,
	CmeQuestionDraft,
	DraftAttachment,
} from "@/features/teacher/case-authoring/schema";
import { storeDraftAttachments } from "@/features/case-materials/storage";
import { isActiveTeacherCase } from "@/features/teacher/cases/case-lifecycle";
import { rejectNonE2EMode } from "@/lib/e2e/route-helpers";

type E2EStudentDashboardActiveCase = {
	attachments?: DraftAttachment[];
	caseId?: string;
	cmeQuestions?: CmeQuestionDraft[];
	description: string;
	lectureText?: string;
	modelAnswer: string;
	presentation: string;
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
	const caseId = String(input.caseId ?? "").trim();
	const attachments = parseAttachments(input.attachments);
	const cmeQuestions = parseCmeQuestions(input.cmeQuestions);
	const description = String(input.description ?? "").trim();
	const lectureText = String(input.lectureText ?? "").trim();
	const modelAnswer = String(input.modelAnswer ?? "").trim();
	const presentation = String(input.presentation ?? "").trim();
	const title = String(input.title ?? "").trim();
	const publishedAt = Number(input.publishedAt);
	const deadlineAt = Number(input.deadlineAt);

	if (!title || !Number.isFinite(publishedAt) || !Number.isFinite(deadlineAt)) {
		throw new Error("activeCase is missing required student dashboard fields.");
	}

	return {
		...(caseId ? { caseId } : {}),
		attachments,
		cmeQuestions,
		description:
			description ||
			"Review the active case presentation and begin your clinical reasoning.",
		lectureText:
			lectureText ||
			"Teaching resources are provided by the teacher for this case study.",
		modelAnswer:
			modelAnswer ||
			"The model answer is provided by the teacher for side-by-side comparison.",
		presentation:
			presentation ||
			"Patient history, presenting symptoms, laboratory findings, and the clinical decision context are described for learners.",
		title,
		publishedAt,
		deadlineAt,
	};
}

function parseCmeQuestions(value: unknown): CmeQuestionDraft[] {
	if (value === null || value === undefined) {
		return defaultCmeQuestions();
	}

	if (!Array.isArray(value)) {
		throw new Error("activeCase.cmeQuestions must be an array.");
	}

	return value.map((question, questionIndex) => {
		if (typeof question !== "object" || question === null) {
			throw new Error(
				`activeCase.cmeQuestions[${questionIndex}] must be an object.`,
			);
		}

		const input = question as Record<string, unknown>;
		const id = String(input.id ?? "").trim();
		const prompt = String(input.prompt ?? "").trim();
		const correctOptionId = String(input.correctOptionId ?? "").trim();
		const options = parseCmeOptions(input.options, questionIndex);

		if (
			!id ||
			!prompt ||
			options.length < 2 ||
			options.length > 5 ||
			!options.some((option) => option.id === correctOptionId)
		) {
			throw new Error(
				`activeCase.cmeQuestions[${questionIndex}] is missing required fields.`,
			);
		}

		return {
			id,
			prompt,
			options,
			correctOptionId,
		};
	});
}

function parseCmeOptions(value: unknown, questionIndex: number) {
	if (!Array.isArray(value)) {
		throw new Error(
			`activeCase.cmeQuestions[${questionIndex}].options must be an array.`,
		);
	}

	return value.map((option, optionIndex) => {
		if (typeof option !== "object" || option === null) {
			throw new Error(
				`activeCase.cmeQuestions[${questionIndex}].options[${optionIndex}] must be an object.`,
			);
		}

		const input = option as Record<string, unknown>;
		const id = String(input.id ?? "").trim();
		const text = String(input.text ?? "").trim();

		if (!id || !text) {
			throw new Error(
				`activeCase.cmeQuestions[${questionIndex}].options[${optionIndex}] is missing required fields.`,
			);
		}

		return {
			id,
			text,
		};
	});
}

function parseAttachments(value: unknown): DraftAttachment[] {
	if (value === null || value === undefined) {
		return [];
	}

	if (!Array.isArray(value)) {
		throw new Error("activeCase.attachments must be an array.");
	}

	return value.flatMap((attachment, index) => {
		if (typeof attachment !== "object" || attachment === null) {
			throw new Error(`activeCase.attachments[${index}] must be an object.`);
		}

		const input = attachment as Record<string, unknown>;
		const dataUrl = String(input.dataUrl ?? "").trim();
		const id = String(input.id ?? "").trim();
		const name = String(input.name ?? "").trim();
		const size = Number(input.size);
		const storageKey = String(input.storageKey ?? "").trim();
		const type = String(input.type ?? "").trim();
		const lastModified = Number(input.lastModified);

		if (
			(!dataUrl && !storageKey) ||
			!id ||
			!name ||
			!Number.isFinite(size) ||
			!type ||
			!Number.isFinite(lastModified)
		) {
			throw new Error(
				`activeCase.attachments[${index}] is missing required fields.`,
			);
		}

		return [
			{
				...(dataUrl ? { dataUrl } : {}),
				id,
				name,
				size,
				...(storageKey ? { storageKey } : {}),
				type,
				lastModified,
			},
		];
	});
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
		const certificateBranding = parseCertificateBranding(
			input.certificateBranding,
			index,
		);
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
			certificateBranding,
			certificateId,
			caseId,
			caseTitle,
			completedAt,
			studentDisplayName,
			studentProfileId,
		};
	});
}

function parseCertificateBranding(value: unknown, index: number) {
	if (typeof value !== "object" || value === null) {
		throw new Error(`certificates[${index}].certificateBranding is required.`);
	}

	const input = value as Record<string, unknown>;
	const organizationName = String(input.organizationName ?? "").trim();
	const shortName = String(input.shortName ?? "").trim();

	if (!organizationName || !shortName) {
		throw new Error(
			`certificates[${index}].certificateBranding is missing required fields.`,
		);
	}

	return {
		organizationName,
		shortName,
	};
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
		const draft = activeCase ? await activeCaseDraft(activeCase) : null;

		seedE2ETeacherCases(
			activeCase && draft
				? [
						{
							caseId:
								activeCase.caseId ?? "e2e-active-student-dashboard-case",
							lifecycle: "published" as const,
							completionCount: 0,
							feedbackCount: 0,
							...activeCase,
							draft,
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

async function activeCaseDraft(
	activeCase: E2EStudentDashboardActiveCase,
): Promise<CaseDraft> {
	const storedAttachments = await storeDraftAttachments({
		attachments: activeCase.attachments ?? [],
		caseId: activeCase.caseId ?? "e2e-active-student-dashboard-case",
	});

	return {
		title: activeCase.title,
		description: activeCase.description,
		presentation: activeCase.presentation,
		modelAnswer: activeCase.modelAnswer,
		lectureText:
			activeCase.lectureText ??
			"Teaching resources are provided by the teacher for this case study.",
		attachments: storedAttachments.attachments,
		cmeQuestions: activeCase.cmeQuestions ?? defaultCmeQuestions(),
		deadlineDate: "",
	};
}

function defaultCmeQuestions(): CmeQuestionDraft[] {
	return [
		{
			id: "question-1",
			prompt: "Which finding best supports the working diagnosis?",
			options: [
				{ id: "question-1-a", text: "Persistent fever with focal findings" },
				{ id: "question-1-b", text: "Resolved symptoms without treatment" },
			],
			correctOptionId: "question-1-a",
		},
		{
			id: "question-2",
			prompt: "Which next step is most appropriate for this case?",
			options: [
				{ id: "question-2-a", text: "Review the available investigation results" },
				{ id: "question-2-b", text: "Ignore the presenting history" },
			],
			correctOptionId: "question-2-a",
		},
		{
			id: "question-3",
			prompt: "Which teaching point should be prioritized?",
			options: [
				{ id: "question-3-a", text: "Use the case evidence to justify management" },
				{ id: "question-3-b", text: "Delay all clinical reasoning" },
			],
			correctOptionId: "question-3-a",
		},
	];
}
