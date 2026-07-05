import "server-only";

import { Resource } from "sst";

export type LinkedResources = {
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
			linkedValue(() => linkedResources.RegistrationWorkflowTable?.name),
			"RegistrationWorkflowTable.name",
		),
		emailSender:
			process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
		resendApiKey: required(
			linkedValue(() => linkedResources.ResendApiKey?.value),
			"ResendApiKey.value",
		),
	};
}

export function getSessionAuthResources() {
	const e2eMode = isE2EMode();

	return {
		userPoolId: e2eMode
			? "e2e-auth-user-pool"
			: required(
					linkedValue(() => linkedResources.AuthUserPool?.id),
					"AuthUserPool.id",
				),
		userPoolClientId: e2eMode
			? "e2e-auth-user-pool-client"
			: required(
					linkedValue(() => linkedResources.AuthUserPoolClient?.id),
					"AuthUserPoolClient.id",
				),
		userProfileTableName: e2eMode
			? "e2e-user-profile-table"
			: required(
					linkedValue(() => linkedResources.UserProfileTable?.name),
					"UserProfileTable.name",
				),
		betterAuthSecret: required(
			linkedValue(() => linkedResources.BetterAuthSecret?.value) ??
				(e2eMode
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
