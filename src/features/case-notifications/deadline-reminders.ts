import { getCaseDeadlineReminderService } from "./deadline-reminders-service";

export async function handler() {
	const result =
		await getCaseDeadlineReminderService().sendDeadlineReminderEmails();

	return {
		statusCode: 200,
		body: JSON.stringify(result),
	};
}
