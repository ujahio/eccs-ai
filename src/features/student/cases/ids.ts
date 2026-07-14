import { createHash } from "node:crypto";

type StudentCaseScopedIdArgs = {
	caseId: string;
	studentProfileId: string;
};

export function studentCaseCertificateId(args: StudentCaseScopedIdArgs) {
	return studentCaseScopedId({
		...args,
		prefix: "cert",
	});
}

export function studentCaseCompletionId(args: StudentCaseScopedIdArgs) {
	return studentCaseScopedId({
		...args,
		prefix: "case_completion",
	});
}

export function studentCaseQuizAttemptId(args: StudentCaseScopedIdArgs) {
	return studentCaseScopedId({
		...args,
		prefix: "quiz_attempt",
	});
}

function studentCaseScopedId({
	caseId,
	prefix,
	studentProfileId,
}: StudentCaseScopedIdArgs & {
	prefix: "case_completion" | "cert" | "quiz_attempt";
}) {
	const digest = createHash("sha256")
		.update(`${studentProfileId}\n${caseId}`)
		.digest("base64url")
		.slice(0, 32);

	return `${prefix}_${digest}`;
}
