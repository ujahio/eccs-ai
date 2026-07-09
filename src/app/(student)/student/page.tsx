import { StudentDashboard } from "@/features/student/dashboard/student-dashboard";
import { getStudentDashboardSummary } from "@/features/student/dashboard/summary";
import { requireStudentSession } from "@/lib/auth/session";

export default async function StudentDashboardPage() {
	const { profile } = await requireStudentSession();
	const summary = await getStudentDashboardSummary(profile.profileId);

	return (
		<StudentDashboard
			activeCase={summary.activeCase}
			recentCertificates={summary.recentCertificates}
			studentName={profile.fullName}
		/>
	);
}
