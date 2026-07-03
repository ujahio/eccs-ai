import "server-only";

import { betterAuth } from "better-auth";
import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";
import {
	AwsCognitoIdTokenVerifier,
	E2ECognitoIdTokenVerifier,
} from "./cognito-id-token-verifier";
import { cognitoSessionBridge } from "./cognito-session-bridge";

const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

const resources = getSessionAuthResources();
const bridgeDependencies = createBridgeDependencies();
const trustedOrigins = Array.from(
	new Set([
		resources.betterAuthUrl,
		resources.appBaseUrl,
		...(process.env.NODE_ENV === "production"
			? []
			: ["http://localhost:3001", "http://127.0.0.1:3001"]),
	])
);

export const auth = betterAuth({
	appName: "ECCS",
	baseURL: resources.betterAuthUrl,
	secret: resources.betterAuthSecret,
	trustedOrigins,
	session: {
		expiresIn: SESSION_LIFETIME_SECONDS,
		updateAge: SESSION_LIFETIME_SECONDS,
		disableSessionRefresh: true,
		cookieCache: {
			enabled: true,
			maxAge: SESSION_LIFETIME_SECONDS,
			strategy: "jwe",
			refreshCache: false,
		},
	},
	defaultCookieAttributes: {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	},
	useSecureCookies: process.env.NODE_ENV === "production",
	plugins: [
		cognitoSessionBridge({
			appBaseUrl: resources.appBaseUrl,
			trustedOrigins,
			...bridgeDependencies,
		}),
	],
});

function createBridgeDependencies() {
	if (isE2EMode()) {
		const { identity, repository } = getE2EAdapters();

		return {
			identity,
			profiles: repository,
			tokenVerifier: new E2ECognitoIdTokenVerifier(),
		};
	}

	return {
		identity: new CognitoAuthAdapter(
			resources.userPoolId,
			resources.userPoolClientId
		),
		profiles: new DynamoAuthRepository(
			"",
			resources.userProfileTableName
		),
		tokenVerifier: new AwsCognitoIdTokenVerifier(
			resources.userPoolId,
			resources.userPoolClientId
		),
	};
}
