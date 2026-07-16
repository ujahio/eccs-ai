import { getCaseDeadlineReminderService } from "./deadline-reminders-service";

export async function handler() {
	const service = await getCaseDeadlineReminderService();
	const result = await service.sendDeadlineReminderEmails();

	return {
		statusCode: 200,
		body: JSON.stringify(result),
	};
}
