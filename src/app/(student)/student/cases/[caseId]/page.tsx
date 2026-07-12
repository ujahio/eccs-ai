import { notFound } from "next/navigation";
import {
	completeStudentCaseQuizReviewForm,
	submitStudentCaseQuizForm,
} from "@/features/student/cases/actions";
import { StudentCaseFlow } from "@/features/student/cases/student-case-flow";
import { getStudentActiveCasePresentation } from "@/features/student/cases/student-case";
import { requireStudentSession } from "@/lib/auth/session";

type StudentCasePageProps = {
	params: Promise<{
		caseId: string;
	}>;
};

export default async function StudentCasePage({ params }: StudentCasePageProps) {
	await requireStudentSession();

	const { caseId } = await params;
	const caseRecord = await getStudentActiveCasePresentation(caseId);

	if (!caseRecord) {
		notFound();
	}

	return (
		<StudentCaseFlow
			caseRecord={caseRecord}
			quizAction={submitStudentCaseQuizForm}
			quizReviewAction={completeStudentCaseQuizReviewForm}
		/>
	);
}
