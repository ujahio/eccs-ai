import { activeCaseArchivePayloadFromEvent } from "./archive-active-case";
import { getTeacherCaseArchiveService } from "./archive-active-case-service";

export async function handler(event: unknown) {
	const payload = activeCaseArchivePayloadFromEvent(event);
	const result = await getTeacherCaseArchiveService().archiveActiveCase(payload);

	return {
		statusCode: 200,
		body: JSON.stringify(result),
	};
}
