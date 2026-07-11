"use server";

import { revalidatePath } from "next/cache";
import {
	completeStudentCaseQuiz,
	DuplicateStudentCaseCertificateError,
	StudentCaseExpiredError,
} from "@/features/student/cases/student-case";
import type { StudentCaseQuizFormState } from "@/features/student/cases/state";
import { requireStudentSession } from "@/lib/auth/session";

export async function submitStudentCaseQuizForm(
	_state: StudentCaseQuizFormState,
	formData: FormData,
): Promise<StudentCaseQuizFormState> {
	const { profile } = await requireStudentSession();
	const caseId = stringFromFormData(formData.get("caseId"));

	if (!caseId) {
		return {
			message: "Unable to submit this quiz. Return to your dashboard and retry.",
			status: "error",
			submittedAt: Date.now(),
		};
	}

	const answers = quizAnswersFromFormData(formData);

	try {
		const result = await completeStudentCaseQuiz({
			answers,
			caseId,
			studentDisplayName: profile.fullName,
			studentProfileId: profile.profileId,
		});

		if (result.status === "failed") {
			return {
				message:
					"Quiz attempt submitted. Result: did not pass. Review the material and try again.",
				status: "failed",
				submittedAt: Date.now(),
			};
		}

		revalidatePath("/student");
		revalidatePath("/student/certificates");

		return {
			certificateId: result.certificateId,
			message: "Quiz passed. Your certificate is ready.",
			status: "passed",
			submittedAt: Date.now(),
		};
	} catch (error) {
		if (error instanceof StudentCaseExpiredError) {
			return {
				message:
					"This case is no longer active. Return to your dashboard for the current case status.",
				status: "expired",
				submittedAt: Date.now(),
			};
		}

		if (error instanceof DuplicateStudentCaseCertificateError) {
			return {
				message:
					"A certificate has already been earned for this case. Duplicate submissions are rejected.",
				status: "duplicate",
				submittedAt: Date.now(),
			};
		}

		return {
			message: "Unable to submit this quiz right now. Please try again.",
			status: "error",
			submittedAt: Date.now(),
		};
	}
}

function quizAnswersFromFormData(formData: FormData) {
	const answers: Record<string, string> = {};

	for (const [key, value] of formData.entries()) {
		if (!key.startsWith("answer:")) {
			continue;
		}

		const questionId = key.slice("answer:".length).trim();
		const optionId = stringFromFormData(value);

		if (questionId && optionId) {
			answers[questionId] = optionId;
		}
	}

	return answers;
}

function stringFromFormData(value: FormDataEntryValue | null) {
	return typeof value === "string" ? value.trim() : "";
}
