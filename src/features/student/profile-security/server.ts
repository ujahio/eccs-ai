import "server-only";

import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { ResendRegistrationEmailSender } from "@/lib/aws/email";
import { getAuthResources } from "@/lib/aws/resources";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";
import { StudentProfileService } from "./service";

export function createProfileSecurityService() {
	if (isE2EMode()) {
		const { identity, repository, email } = getE2EAdapters();

		return new StudentProfileService(identity, repository, email, {
			appBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
		});
	}

	const resources = getAuthResources();
	const repository = new DynamoAuthRepository(
		resources.registrationWorkflowTableName,
		resources.userProfileTableName,
	);
	const identity = new CognitoAuthAdapter(
		resources.userPoolId,
		resources.userPoolClientId,
	);
	const email = new ResendRegistrationEmailSender(
		resources.emailSender,
		resources.resendApiKey,
		resources.appBaseUrl,
	);

	return new StudentProfileService(identity, repository, email, {
		appBaseUrl: resources.appBaseUrl,
	});
}

export const createStudentProfileService = createProfileSecurityService;
