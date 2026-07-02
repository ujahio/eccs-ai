import "server-only";

import { Resource } from "sst";

type LinkedResources = {
	AuthUserPool: { id: string };
	AuthUserPoolClient: { id: string };
	RegistrationWorkflowTable: { name: string };
	UserProfileTable: { name: string };
	ResendApiKey: { value: string };
};

const linkedResources = Resource as unknown as Partial<LinkedResources>;

function required(value: string | undefined, label: string) {
	if (!value) {
		throw new Error(`Missing required auth resource: ${label}`);
	}

	return value;
}

export function getAuthResources() {
	return {
		userPoolId: required(
			linkedResources.AuthUserPool?.id ?? process.env.COGNITO_USER_POOL_ID,
			"AuthUserPool.id",
		),
		userPoolClientId: required(
			linkedResources.AuthUserPoolClient?.id ??
				process.env.COGNITO_USER_POOL_CLIENT_ID,
			"AuthUserPoolClient.id",
		),
		registrationWorkflowTableName: required(
			linkedResources.RegistrationWorkflowTable?.name ??
				process.env.REGISTRATION_WORKFLOW_TABLE_NAME,
			"RegistrationWorkflowTable.name",
		),
		userProfileTableName: required(
			linkedResources.UserProfileTable?.name ??
				process.env.USER_PROFILE_TABLE_NAME,
			"UserProfileTable.name",
		),
		emailSender:
			process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
		resendApiKey: required(
			linkedResources.ResendApiKey?.value ?? process.env.RESEND_API_KEY,
			"ResendApiKey.value",
		),
		appBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
	};
}
