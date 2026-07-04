import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { CognitoAuthAdapter } from "@/lib/aws/cognito";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";
import { auth } from "./auth";
import type { StudentProfileRecord } from "@/features/auth/registration/repository";

export async function requireStudentSession() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	const profile = await getStudentProfile(session.user.id);

	if (!profile || profile.role !== "student") {
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
