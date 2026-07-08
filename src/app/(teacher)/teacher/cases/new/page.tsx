import { CaseAuthoringWizard } from "@/features/teacher/case-authoring/case-authoring-wizard";
import { getTeacherDashboardSummary } from "@/features/teacher/dashboard/cases";

export default async function NewTeacherCasePage() {
	const { activeCase } = await getTeacherDashboardSummary();

	return (
		<CaseAuthoringWizard
			activePublishedCase={
				activeCase
					? {
							title: activeCase.title,
							deadlineAt: activeCase.deadlineAt,
						}
					: null
			}
		/>
	);
}
