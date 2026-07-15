import { notFound } from "next/navigation";
import { getTeacherStudentCaseResponse } from "@/features/teacher/case-review/case-review";
import { TeacherStudentResponseDetail } from "@/features/teacher/case-review/teacher-case-review";

type TeacherStudentResponsePageProps = {
	params: Promise<{
		caseId: string;
		studentProfileId: string;
	}>;
};

export default async function TeacherStudentResponsePage({
	params,
}: TeacherStudentResponsePageProps) {
	const { caseId, studentProfileId } = await params;
	const review = await getTeacherStudentCaseResponse(caseId, studentProfileId);

	if (!review) {
		notFound();
	}

	return (
		<TeacherStudentResponseDetail
			caseRecord={review.caseRecord}
			completion={review.completion}
		/>
	);
}
