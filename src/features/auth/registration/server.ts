import "server-only";

import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { SesRegistrationEmailSender } from "@/lib/aws/email";
import { getAuthResources } from "@/lib/aws/resources";
import { isE2EMode, getE2EAdapters } from "@/lib/e2e/in-memory-auth";
import { RegistrationService } from "./service";

export function createRegistrationService() {
	if (isE2EMode()) {
		const { identity, repository, email } = getE2EAdapters();

		return new RegistrationService({
			repository,
			identity,
			email,
			config: {
				appBaseUrl:
					process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
			},
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
	const email = new SesRegistrationEmailSender(resources.emailSender);

	return new RegistrationService({
		repository,
		identity,
		email,
		config: {
			appBaseUrl: resources.appBaseUrl,
		},
	});
}
