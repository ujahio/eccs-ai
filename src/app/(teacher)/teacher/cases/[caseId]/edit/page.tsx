import { CaseAuthoringWizard } from "@/features/teacher/case-authoring/case-authoring-wizard";
import { getTeacherDashboardSummary } from "@/features/teacher/dashboard/cases";

type EditTeacherCasePageProps = {
	params: Promise<{
		caseId: string;
	}>;
};

export default async function EditTeacherCasePage({
	params,
}: EditTeacherCasePageProps) {
	const [{ activeCase }, { caseId }] = await Promise.all([
		getTeacherDashboardSummary(),
		params,
	]);

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
			draftCaseId={caseId}
		/>
	);
}
