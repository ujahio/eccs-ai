import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";
import { getAuth } from "./auth";
import type { StudentProfileRecord } from "@/features/auth/registration/repository";

export async function requireStudentSession() {
	const requestHeaders = await headers();
	const session = await getAuth().api.getSession({
		headers: requestHeaders,
	});

	if (!session) {
		redirect("/login");
	}

	const profile = await getStudentProfile(session.user.id);

	if (!profile || profile.role !== "student") {
		redirect("/login");
	}

	if (isSessionInvalidated(session, profile)) {
		redirect("/login");
	}

	const isLoginEligible = await isStudentLoginEligible(profile);

	if (!isLoginEligible) {
		redirect("/login");
	}

	return {
		session,
		profile,
	};
}

export function isSessionInvalidated(
	session: { session?: { createdAt?: Date | string | number } } | null,
	profile: StudentProfileRecord
) {
	if (!profile.sessionsInvalidatedAt) {
		return false;
	}

	const createdAt = sessionCreatedAtMilliseconds(
		session?.session?.createdAt
	);

	return createdAt !== null && createdAt <= profile.sessionsInvalidatedAt;
}

function sessionCreatedAtMilliseconds(
	value: Date | string | number | undefined
) {
	if (value instanceof Date) {
		return value.getTime();
	}

	if (typeof value === "number") {
		return value > 9_999_999_999 ? value : value * 1000;
	}

	if (typeof value === "string") {
		const parsed = Date.parse(value);

		return Number.isNaN(parsed) ? null : parsed;
	}

	return null;
}

async function getStudentProfile(profileId: string) {
	if (isE2EMode()) {
		const { repository } = getE2EAdapters();

		return repository.getStudentProfileById(profileId);
	}

	const resources = getSessionAuthResources();
	const repository = new DynamoAuthRepository("", resources.userProfileTableName);

	return repository.getStudentProfileById(profileId);
}

async function isStudentLoginEligible(profile: StudentProfileRecord) {
	if (isE2EMode()) {
		const { identity } = getE2EAdapters();

		return identity.isStudentLoginEligible({
			emailNormalized: profile.emailNormalized,
		});
	}

	const resources = getSessionAuthResources();
	const identity = new CognitoAuthAdapter(
		resources.userPoolId,
		resources.userPoolClientId
	);

	return identity.isStudentLoginEligible({
		emailNormalized: profile.emailNormalized,
	});
}
