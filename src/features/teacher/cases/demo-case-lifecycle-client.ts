export type TeacherLifecycleOverride = "published" | "archived";

export async function patchTeacherCaseLifecycle(
	fetcher: typeof fetch,
	payload: {
		caseId: string;
		lifecycle: TeacherLifecycleOverride;
	},
) {
	const response = await fetcher("/api/teacher/demo-case-lifecycle", {
		body: JSON.stringify(payload),
		headers: {
			"Content-Type": "application/json",
		},
		method: "PATCH",
	});

	if (!response.ok) {
		throw new Error("Case lifecycle update failed.");
	}
}
