import "server-only";

import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { CognitoIdTokenPayload } from "aws-jwt-verify/jwt-model";
import { normalizeEmail } from "@/features/auth/registration/schema";
import { getE2EAuthStore } from "@/lib/e2e/in-memory-auth";

export type VerifiedCognitoIdToken = {
	cognitoSub: string;
	emailNormalized: string;
	emailVerified: boolean;
	groups: string[];
};

export interface CognitoIdTokenVerifier {
	verifyIdToken(idToken: string): Promise<VerifiedCognitoIdToken>;
}

export class AwsCognitoIdTokenVerifier implements CognitoIdTokenVerifier {
	private readonly verifier;

	constructor(userPoolId: string, userPoolClientId: string) {
		this.verifier = CognitoJwtVerifier.create({
			userPoolId,
			clientId: userPoolClientId,
			tokenUse: "id",
		});
	}

	async verifyIdToken(idToken: string): Promise<VerifiedCognitoIdToken> {
		const payload = await this.verifier.verify(idToken);

		return toVerifiedToken(payload);
	}
}

export class E2ECognitoIdTokenVerifier implements CognitoIdTokenVerifier {
	async verifyIdToken(idToken: string): Promise<VerifiedCognitoIdToken> {
		const emailNormalized = idToken.startsWith("e2e-id-")
			? idToken.slice("e2e-id-".length)
			: "";
		const user = getE2EAuthStore().users.get(emailNormalized);

		if (!emailNormalized || !user?.enabled) {
			throw new Error("Invalid E2E Cognito ID token.");
		}

		return {
			cognitoSub: user.cognitoSub,
			emailNormalized,
			emailVerified: true,
			groups: ["student"],
		};
	}
}

function toVerifiedToken(
	payload: CognitoIdTokenPayload
): VerifiedCognitoIdToken {
	const email = typeof payload.email === "string" ? payload.email : "";
	const groups = Array.isArray(payload["cognito:groups"])
		? payload["cognito:groups"].filter(
				(group): group is string => typeof group === "string"
			)
		: [];

	if (!payload.sub || !email) {
		throw new Error("Cognito ID token is missing required identity claims.");
	}

	return {
		cognitoSub: payload.sub,
		emailNormalized: normalizeEmail(email),
		emailVerified: payload.email_verified === true,
		groups,
	};
}

