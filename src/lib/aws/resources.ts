import "server-only";

import { Resource } from "sst";

export type LinkedResources = {
	AuthUserPool: { id: string };
	AuthUserPoolClient: { id: string };
	CaseMaterialBucket: { name: string };
	RegistrationWorkflowTable: { name: string };
	UserProfileTable: { name: string };
	TeacherCaseTable: { name: string };
	StudentCertificateTable: { name: string };
	StudentCaseCompletionTable: { name: string };
	StudentQuizAttemptTable: { name: string };
	ResendApiKey: { value: string };
	BetterAuthSecret: { value: string };
	ActiveCaseArchiveSchedule: {
		groupName: string;
		roleArn: string;
		scheduleName: string;
		targetArn: string;
	};
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

function envOrLinked(
	envName: string,
	readLinked: () => string | undefined,
	label: string,
) {
	return required(
		process.env[envName] ?? linkedValue(readLinked),
		`${envName} or ${label}`,
	);
}

export function getAuthResources() {
	const e2eMode = isE2EMode();
	const sessionResources = getSessionAuthResources();

	return {
		...sessionResources,
		registrationWorkflowTableName: e2eMode
			? "e2e-registration-workflow-table"
			: envOrLinked(
					"REGISTRATION_WORKFLOW_TABLE_NAME",
					() => linkedResources.RegistrationWorkflowTable?.name,
					"RegistrationWorkflowTable.name",
				),
		emailSender:
			process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
		resendApiKey: e2eMode
			? "e2e-resend-api-key"
			: envOrLinked(
					"RESEND_API_KEY",
					() => linkedResources.ResendApiKey?.value,
					"ResendApiKey.value",
				),
	};
}

export function getCaseNotificationResources() {
	const e2eMode = isE2EMode();

	return {
		userProfileTableName: e2eMode
			? "e2e-user-profile-table"
			: envOrLinked(
					"USER_PROFILE_TABLE_NAME",
					() => linkedResources.UserProfileTable?.name,
					"UserProfileTable.name",
				),
		teacherCaseTableName: e2eMode
			? "e2e-teacher-case-table"
			: envOrLinked(
					"TEACHER_CASE_TABLE_NAME",
					() => linkedResources.TeacherCaseTable?.name,
					"TeacherCaseTable.name",
				),
		studentCertificateTableName: e2eMode
			? "e2e-student-certificate-table"
			: envOrLinked(
					"STUDENT_CERTIFICATE_TABLE_NAME",
					() => linkedResources.StudentCertificateTable?.name,
					"StudentCertificateTable.name",
				),
		emailSender:
			process.env.ECCS_EMAIL_SENDER ?? "no-reply@contact.eccs-online.xyz",
		resendApiKey: e2eMode
			? "e2e-resend-api-key"
			: envOrLinked(
					"RESEND_API_KEY",
					() => linkedResources.ResendApiKey?.value,
					"ResendApiKey.value",
				),
		appBaseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001",
	};
}

export function getActiveCaseArchiveScheduleResources() {
	// EventBridge Scheduler schedule metadata comes from raw aws.* resources in
	// infra/case-archive.ts, so the Next server receives these values as either
	// explicit deployment env vars or an SST custom linkable in local sst shell.
	const e2eMode = isE2EMode();

	return {
		groupName: e2eMode
			? "default"
			: process.env.CASE_ARCHIVE_SCHEDULE_GROUP_NAME ??
				linkedValue(() => linkedResources.ActiveCaseArchiveSchedule?.groupName) ??
				"default",
		roleArn: e2eMode
			? "arn:aws:iam::000000000000:role/e2e-active-case-archive"
			: envOrLinked(
					"CASE_ARCHIVE_SCHEDULER_ROLE_ARN",
					() => linkedResources.ActiveCaseArchiveSchedule?.roleArn,
					"ActiveCaseArchiveSchedule.roleArn",
				),
		scheduleName: e2eMode
			? "e2e-active-case-archive"
			: envOrLinked(
					"CASE_ARCHIVE_SCHEDULE_NAME",
					() => linkedResources.ActiveCaseArchiveSchedule?.scheduleName,
					"ActiveCaseArchiveSchedule.scheduleName",
				),
		targetArn: e2eMode
			? "arn:aws:lambda:us-east-2:000000000000:function:e2e-active-case-archive"
			: envOrLinked(
					"CASE_ARCHIVE_TARGET_ARN",
					() => linkedResources.ActiveCaseArchiveSchedule?.targetArn,
					"ActiveCaseArchiveSchedule.targetArn",
				),
	};
}

export function getTeacherCaseArchiveResources() {
	const e2eMode = isE2EMode();

	return {
		teacherCaseTableName: e2eMode
			? "e2e-teacher-case-table"
			: envOrLinked(
					"TEACHER_CASE_TABLE_NAME",
					() => linkedResources.TeacherCaseTable?.name,
					"TeacherCaseTable.name",
				),
	};
}

export function getSessionAuthResources() {
	const e2eMode = isE2EMode();

	return {
		userPoolId: e2eMode
			? "e2e-auth-user-pool"
			: envOrLinked(
					"AUTH_USER_POOL_ID",
					() => linkedResources.AuthUserPool?.id,
					"AuthUserPool.id",
				),
		userPoolClientId: e2eMode
			? "e2e-auth-user-pool-client"
			: envOrLinked(
					"AUTH_USER_POOL_CLIENT_ID",
					() => linkedResources.AuthUserPoolClient?.id,
					"AuthUserPoolClient.id",
				),
		userProfileTableName: e2eMode
			? "e2e-user-profile-table"
			: envOrLinked(
					"USER_PROFILE_TABLE_NAME",
					() => linkedResources.UserProfileTable?.name,
					"UserProfileTable.name",
				),
		teacherCaseTableName: e2eMode
			? "e2e-teacher-case-table"
			: envOrLinked(
					"TEACHER_CASE_TABLE_NAME",
					() => linkedResources.TeacherCaseTable?.name,
					"TeacherCaseTable.name",
				),
		studentCertificateTableName: e2eMode
			? "e2e-student-certificate-table"
			: envOrLinked(
					"STUDENT_CERTIFICATE_TABLE_NAME",
					() => linkedResources.StudentCertificateTable?.name,
					"StudentCertificateTable.name",
				),
		studentCaseCompletionTableName: e2eMode
			? "e2e-student-case-completion-table"
			: envOrLinked(
					"STUDENT_CASE_COMPLETION_TABLE_NAME",
					() => linkedResources.StudentCaseCompletionTable?.name,
					"StudentCaseCompletionTable.name",
				),
		studentQuizAttemptTableName: e2eMode
			? "e2e-student-quiz-attempt-table"
			: envOrLinked(
					"STUDENT_QUIZ_ATTEMPT_TABLE_NAME",
					() => linkedResources.StudentQuizAttemptTable?.name,
					"StudentQuizAttemptTable.name",
				),
		caseMaterialBucketName: e2eMode
			? "e2e-case-material-bucket"
			: envOrLinked(
					"CASE_MATERIAL_BUCKET_NAME",
					() => linkedResources.CaseMaterialBucket?.name,
					"CaseMaterialBucket.name",
				),
		betterAuthSecret: e2eMode
			? "eccs-e2e-better-auth-secret-for-local-tests-only"
			: envOrLinked(
					"BETTER_AUTH_SECRET",
					() => linkedResources.BetterAuthSecret?.value,
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
