import { createRegistrationService } from "./server";

export async function handler() {
	const service = createRegistrationService();
	const result = await service.cleanupExpiredPendingRegistrations();

	console.log("Expired pending registration cleanup completed", result);

	return result;
}
