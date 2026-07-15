import { Resource } from "sst";
import {
	DynamoTeacherCaseArchiveRepository,
	TeacherCaseArchiveService,
} from "./archive-active-case";

type TeacherCaseArchiveResources = {
	TeacherCaseTable: { name: string };
};

const linkedResources =
	Resource as unknown as Partial<TeacherCaseArchiveResources>;

export function getTeacherCaseArchiveService() {
	return new TeacherCaseArchiveService(
		new DynamoTeacherCaseArchiveRepository(
			required(
				linkedValue(() => linkedResources.TeacherCaseTable?.name),
				"TeacherCaseTable.name",
			),
		),
	);
}

function required(value: string | undefined, label: string) {
	if (!value) {
		throw new Error(`Missing required case archive resource: ${label}`);
	}

	return value;
}

function linkedValue(read: () => string | undefined) {
	try {
		return read();
	} catch {
		return undefined;
	}
}
