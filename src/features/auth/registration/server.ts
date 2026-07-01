import "server-only";

import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { SesRegistrationEmailSender } from "@/lib/aws/email";
import { getAuthResources } from "@/lib/aws/resources";
import { RegistrationService } from "./service";

export function createRegistrationService() {
	const resources = getAuthResources();
	const repository = new DynamoAuthRepository(
		resources.registrationWorkflowTableName,
		resources.userProfileTableName
	);
	const identity = new CognitoAuthAdapter(
		resources.userPoolId,
		resources.userPoolClientId
	);
	const email = new SesRegistrationEmailSender(resources.emailSender);

	return new RegistrationService({
		repository,
		identity,
		email,
		config: {
			appBaseUrl: resources.appBaseUrl
		}
	});
}
