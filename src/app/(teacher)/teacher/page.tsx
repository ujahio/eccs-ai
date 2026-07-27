import { TeacherDashboardReview } from "@/features/teacher/dashboard/teacher-dashboard-review";
import { getTeacherDashboardSummary } from "@/features/teacher/dashboard/cases";

export default async function TeacherDashboardPage() {
	const summary = await getTeacherDashboardSummary();

	return <TeacherDashboardReview {...summary} />;
}
