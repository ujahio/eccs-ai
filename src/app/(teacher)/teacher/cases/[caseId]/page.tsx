import { notFound } from "next/navigation";
import { getTeacherCaseReview } from "@/features/teacher/case-review/case-review";
import { TeacherCaseReviewList } from "@/features/teacher/case-review/teacher-case-review";

type TeacherCaseReviewPageProps = {
	params: Promise<{
		caseId: string;
	}>;
};

export default async function TeacherCaseReviewPage({
	params,
}: TeacherCaseReviewPageProps) {
	const { caseId } = await params;
	const review = await getTeacherCaseReview(caseId);

	if (!review) {
		notFound();
	}

	return <TeacherCaseReviewList {...review} />;
}
