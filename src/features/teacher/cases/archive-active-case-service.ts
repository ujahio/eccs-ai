import {
	DynamoTeacherCaseArchiveRepository,
	TeacherCaseArchiveService,
} from "./archive-active-case";

export async function getTeacherCaseArchiveService() {
	const { getTeacherCaseArchiveResources } = await import("@/lib/aws/resources");
	const resources = getTeacherCaseArchiveResources();

	return new TeacherCaseArchiveService(
		new DynamoTeacherCaseArchiveRepository(
			resources.teacherCaseTableName,
		),
	);
}
