import "server-only";

import { Resource } from "sst";

type LinkedResources = {
	AuthUserPool: { id: string };
	AuthUserPoolClient: { id: string };
	RegistrationWorkflowTable: { name: string };
	UserProfileTable: { name: string };
	ResendApiKey: { value: string };
	BetterAuthSecret: { value: string };
};

const linkedResources = Resource as unknown as Partial<LinkedResources>;

function required(value: string | undefined, label: string) {
	if (!value) {
		throw new Error(`Missing required auth resource: ${label}`);
	}

	return value;
}

function linkedValue(read: () => string | undefined) {
	try {
		return read();
	} catch {
		return undefined;
	}
}

export function getAuthResources() {
	const sessionResources = getSessionAuthResources();

	return {
		...sessionResources,
		registrationWorkflowTableName: required(
			linkedValue(() => linkedResources.RegistrationWorkflowTable?.name) ??
				process.env.REGISTRATION_WORKFLOW_TABLE_NAME,
			"RegistrationWorkflowTable.name",
		),
		emailSender:
			process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
		resendApiKey: required(
			linkedValue(() => linkedResources.ResendApiKey?.value) ??
				process.env.RESEND_API_KEY,
			"ResendApiKey.value",
		),
	};
}

export function getSessionAuthResources() {
	return {
		userPoolId: required(
			linkedValue(() => linkedResources.AuthUserPool?.id) ??
				process.env.COGNITO_USER_POOL_ID,
			"AuthUserPool.id",
		),
		userPoolClientId: required(
			linkedValue(() => linkedResources.AuthUserPoolClient?.id) ??
				process.env.COGNITO_USER_POOL_CLIENT_ID,
			"AuthUserPoolClient.id",
		),
		userProfileTableName: required(
			linkedValue(() => linkedResources.UserProfileTable?.name) ??
				process.env.USER_PROFILE_TABLE_NAME,
			"UserProfileTable.name",
		),
		betterAuthSecret: required(
			linkedValue(() => linkedResources.BetterAuthSecret?.value) ??
				process.env.BETTER_AUTH_SECRET ??
				(isE2EMode()
					? "eccs-e2e-better-auth-secret-for-local-tests-only"
					: undefined),
			"BetterAuthSecret.value",
		),
		betterAuthUrl:
			process.env.BETTER_AUTH_URL ??
			process.env.NEXT_PUBLIC_APP_URL ??
			"http://localhost:3001",
		appBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
	};
}

function isE2EMode() {
	return process.env.AUTH_E2E_MODE === "memory";
}
