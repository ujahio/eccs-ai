import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";
import type { AppRole } from "@/lib/auth/roles";
import { getAuth } from "./auth";
import type {
	AppProfileRecord,
	StudentProfileRecord,
	TeacherProfileRecord,
} from "@/features/auth/registration/repository";

export async function requireRoleSession(role: AppRole) {
	const requestHeaders = await headers();
	const session = await getAuth().api.getSession({
		headers: requestHeaders,
	});

	if (!session) {
		redirect("/login");
	}

	const profile = await getAppProfile(session.user.id);

	if (!profile || profile.role !== role) {
		redirect("/login");
	}

	if (isSessionInvalidated(session, profile)) {
		redirect("/login");
	}

	const isLoginEligible = await isRoleLoginEligible(profile);

	if (!isLoginEligible) {
		redirect("/login");
	}

	return {
		session,
		profile,
	};
}

export async function requireStudentSession() {
	const result = await requireRoleSession("student");

	return {
		session: result.session,
		profile: result.profile as StudentProfileRecord,
	};
}

export async function requireTeacherSession() {
	const result = await requireRoleSession("teacher");

	return {
		session: result.session,
		profile: result.profile as TeacherProfileRecord,
	};
}

export function isSessionInvalidated(
	session: {
		session?: {
			createdAt?: Date | string | number;
			id?: string;
			token?: string;
		};
	} | null,
	profile: AppProfileRecord
) {
	if (!profile.sessionsInvalidatedAt) {
		return false;
	}

	if (
		profile.sessionInvalidationExemptToken &&
		sessionToken(session?.session) === profile.sessionInvalidationExemptToken
	) {
		return false;
	}

	const createdAt = sessionCreatedAtMilliseconds(
		session?.session?.createdAt
	);

	return createdAt === null || createdAt <= profile.sessionsInvalidatedAt;
}

export function sessionToken(
	session: { id?: string; token?: string } | undefined
) {
	return session?.token ?? session?.id ?? null;
}

export function sessionCreatedAtMilliseconds(
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

async function getAppProfile(profileId: string) {
	if (isE2EMode()) {
		const { repository } = getE2EAdapters();

		return repository.getAppProfileById(profileId);
	}

	const resources = getSessionAuthResources();
	const repository = new DynamoAuthRepository("", resources.userProfileTableName);

	return repository.getAppProfileById(profileId);
}

async function isRoleLoginEligible(profile: AppProfileRecord) {
	if (isE2EMode()) {
		const { identity } = getE2EAdapters();

		return identity.isRoleLoginEligible({
			emailNormalized: profile.emailNormalized,
			role: profile.role,
		});
	}

	const resources = getSessionAuthResources();
	const identity = new CognitoAuthAdapter(
		resources.userPoolId,
		resources.userPoolClientId
	);

	return identity.isRoleLoginEligible({
		emailNormalized: profile.emailNormalized,
		role: profile.role,
	});
}
