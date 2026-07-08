import { TeacherCaseLibrary } from "@/features/teacher/case-library/teacher-case-library";
import { getTeacherCaseLibrary } from "@/features/teacher/case-library/cases";

export default async function TeacherCasesPage() {
	const caseLibrary = await getTeacherCaseLibrary();

	return <TeacherCaseLibrary {...caseLibrary} />;
}
