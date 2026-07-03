import "server-only";

import { LoginService } from "./service";
import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { getAuthResources } from "@/lib/aws/resources";
import { isE2EMode, getE2EAdapters } from "@/lib/e2e/in-memory-auth";

export function createLoginService() {
	if (isE2EMode()) {
		const { identity, repository } = getE2EAdapters();

		return new LoginService(identity, repository);
	}

	const resources = getAuthResources();
	const repository = new DynamoAuthRepository(
		resources.registrationWorkflowTableName,
		resources.userProfileTableName
	);
	const identity = new CognitoAuthAdapter(
		resources.userPoolId,
		resources.userPoolClientId
	);

	return new LoginService(identity, repository);
}
