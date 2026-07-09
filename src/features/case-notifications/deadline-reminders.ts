import { getCaseLifecycleNotificationService } from "./server";

export async function handler() {
	const result =
		await getCaseLifecycleNotificationService().sendDeadlineReminderEmails();

	return {
		statusCode: 200,
		body: JSON.stringify(result),
	};
}
