import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DynamoAuthRepository } from "@/lib/aws/dynamodb";
import { getSessionAuthResources } from "@/lib/aws/resources";
import { getE2EAdapters, isE2EMode } from "@/lib/e2e/in-memory-auth";
import { auth } from "./auth";

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

