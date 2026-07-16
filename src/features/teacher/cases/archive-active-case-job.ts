import { activeCaseArchivePayloadFromEvent } from "./archive-active-case";
import { getTeacherCaseArchiveService } from "./archive-active-case-service";

export async function handler(event: unknown) {
	const payload = activeCaseArchivePayloadFromEvent(event);
	const service = await getTeacherCaseArchiveService();
	const result = await service.archiveActiveCase(payload);

	return {
		statusCode: 200,
		body: JSON.stringify(result),
	};
}
