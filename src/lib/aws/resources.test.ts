import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { linkedResources } = vi.hoisted(() => ({
	linkedResources: {} as Record<string, unknown>,
}));

vi.mock("sst", () => ({
	Resource: linkedResources,
}));

const originalEnv = { ...process.env };
const runtimeEnvNames = [
	"AUTH_E2E_MODE",
	"AUTH_USER_POOL_ID",
	"AUTH_USER_POOL_CLIENT_ID",
	"BETTER_AUTH_SECRET",
	"CASE_ARCHIVE_SCHEDULE_GROUP_NAME",
	"CASE_ARCHIVE_SCHEDULE_NAME",
	"CASE_ARCHIVE_SCHEDULER_ROLE_ARN",
	"CASE_ARCHIVE_TARGET_ARN",
	"CASE_MATERIAL_BUCKET_NAME",
	"REGISTRATION_WORKFLOW_TABLE_NAME",
	"RESEND_API_KEY",
	"STUDENT_CASE_COMPLETION_TABLE_NAME",
	"STUDENT_CERTIFICATE_TABLE_NAME",
	"STUDENT_QUIZ_ATTEMPT_TABLE_NAME",
	"TEACHER_CASE_TABLE_NAME",
	"USER_PROFILE_TABLE_NAME",
];

beforeEach(() => {
	for (const key of Object.keys(linkedResources)) {
		delete linkedResources[key];
	}

	process.env = { ...originalEnv };

	for (const name of runtimeEnvNames) {
		delete process.env[name];
	}
});

afterEach(() => {
	vi.unstubAllEnvs();
	process.env = { ...originalEnv };
});

describe("AWS resource resolution", () => {
	it("prefers explicit web runtime environment variables", async () => {
		Object.assign(linkedResources, {
			AuthUserPool: { id: "linked-user-pool" },
			AuthUserPoolClient: { id: "linked-user-pool-client" },
			BetterAuthSecret: { value: "linked-better-auth-secret" },
			CaseMaterialBucket: { name: "linked-case-materials" },
			RegistrationWorkflowTable: { name: "linked-registration-workflow" },
			ResendApiKey: { value: "linked-resend-key" },
			StudentCaseCompletionTable: { name: "linked-case-completions" },
			StudentCertificateTable: { name: "linked-certificates" },
			StudentQuizAttemptTable: { name: "linked-quiz-attempts" },
			TeacherCaseTable: { name: "linked-teacher-cases" },
			UserProfileTable: { name: "linked-user-profiles" },
		});
		vi.stubEnv("AUTH_USER_POOL_ID", "env-user-pool");
		vi.stubEnv("AUTH_USER_POOL_CLIENT_ID", "env-user-pool-client");
		vi.stubEnv("BETTER_AUTH_SECRET", "env-better-auth-secret");
		vi.stubEnv("CASE_MATERIAL_BUCKET_NAME", "env-case-materials");
		vi.stubEnv("REGISTRATION_WORKFLOW_TABLE_NAME", "env-registration-workflow");
		vi.stubEnv("RESEND_API_KEY", "env-resend-key");
		vi.stubEnv("STUDENT_CASE_COMPLETION_TABLE_NAME", "env-case-completions");
		vi.stubEnv("STUDENT_CERTIFICATE_TABLE_NAME", "env-certificates");
		vi.stubEnv("STUDENT_QUIZ_ATTEMPT_TABLE_NAME", "env-quiz-attempts");
		vi.stubEnv("TEACHER_CASE_TABLE_NAME", "env-teacher-cases");
		vi.stubEnv("USER_PROFILE_TABLE_NAME", "env-user-profiles");
		vi.stubEnv("CASE_ARCHIVE_SCHEDULE_GROUP_NAME", "env-schedule-group");
		vi.stubEnv("CASE_ARCHIVE_SCHEDULE_NAME", "env-schedule");
		vi.stubEnv(
			"CASE_ARCHIVE_SCHEDULER_ROLE_ARN",
			"arn:aws:iam::123456789012:role/env-scheduler",
		);
		vi.stubEnv(
			"CASE_ARCHIVE_TARGET_ARN",
			"arn:aws:lambda:me-central-1:123456789012:function:env-archive",
		);

		const {
			getActiveCaseArchiveScheduleResources,
			getAuthResources,
			getSessionAuthResources,
		} = await import("./resources");

		expect(getSessionAuthResources()).toMatchObject({
			betterAuthSecret: "env-better-auth-secret",
			caseMaterialBucketName: "env-case-materials",
			studentCaseCompletionTableName: "env-case-completions",
			studentCertificateTableName: "env-certificates",
			studentQuizAttemptTableName: "env-quiz-attempts",
			teacherCaseTableName: "env-teacher-cases",
			userPoolClientId: "env-user-pool-client",
			userPoolId: "env-user-pool",
			userProfileTableName: "env-user-profiles",
		});
		expect(getAuthResources()).toMatchObject({
			registrationWorkflowTableName: "env-registration-workflow",
			resendApiKey: "env-resend-key",
		});
		expect(getActiveCaseArchiveScheduleResources()).toEqual({
			groupName: "env-schedule-group",
			roleArn: "arn:aws:iam::123456789012:role/env-scheduler",
			scheduleName: "env-schedule",
			targetArn:
				"arn:aws:lambda:me-central-1:123456789012:function:env-archive",
		});
	});

	it("falls back to SST linked resources for local sst shell usage", async () => {
		Object.assign(linkedResources, {
			ActiveCaseArchiveSchedule: {
				groupName: "linked-schedule-group",
				roleArn: "arn:aws:iam::123456789012:role/linked-scheduler",
				scheduleName: "linked-schedule",
				targetArn:
					"arn:aws:lambda:us-east-2:123456789012:function:linked-archive",
			},
			AuthUserPool: { id: "linked-user-pool" },
			AuthUserPoolClient: { id: "linked-user-pool-client" },
			BetterAuthSecret: { value: "linked-better-auth-secret" },
			CaseMaterialBucket: { name: "linked-case-materials" },
			RegistrationWorkflowTable: { name: "linked-registration-workflow" },
			ResendApiKey: { value: "linked-resend-key" },
			StudentCaseCompletionTable: { name: "linked-case-completions" },
			StudentCertificateTable: { name: "linked-certificates" },
			StudentQuizAttemptTable: { name: "linked-quiz-attempts" },
			TeacherCaseTable: { name: "linked-teacher-cases" },
			UserProfileTable: { name: "linked-user-profiles" },
		});

		const {
			getActiveCaseArchiveScheduleResources,
			getAuthResources,
			getSessionAuthResources,
		} = await import("./resources");

		expect(getSessionAuthResources()).toMatchObject({
			betterAuthSecret: "linked-better-auth-secret",
			caseMaterialBucketName: "linked-case-materials",
			studentCaseCompletionTableName: "linked-case-completions",
			studentCertificateTableName: "linked-certificates",
			studentQuizAttemptTableName: "linked-quiz-attempts",
			teacherCaseTableName: "linked-teacher-cases",
			userPoolClientId: "linked-user-pool-client",
			userPoolId: "linked-user-pool",
			userProfileTableName: "linked-user-profiles",
		});
		expect(getAuthResources()).toMatchObject({
			registrationWorkflowTableName: "linked-registration-workflow",
			resendApiKey: "linked-resend-key",
		});
		expect(getActiveCaseArchiveScheduleResources()).toEqual({
			groupName: "linked-schedule-group",
			roleArn: "arn:aws:iam::123456789012:role/linked-scheduler",
			scheduleName: "linked-schedule",
			targetArn:
				"arn:aws:lambda:us-east-2:123456789012:function:linked-archive",
		});
	});

	it("uses in-memory resource names before env or linked values in e2e mode", async () => {
		Object.assign(linkedResources, {
			ActiveCaseArchiveSchedule: {
				groupName: "linked-schedule-group",
				roleArn: "arn:aws:iam::123456789012:role/linked-scheduler",
				scheduleName: "linked-schedule",
				targetArn:
					"arn:aws:lambda:us-east-2:123456789012:function:linked-archive",
			},
			AuthUserPool: { id: "linked-user-pool" },
			AuthUserPoolClient: { id: "linked-user-pool-client" },
			BetterAuthSecret: { value: "linked-better-auth-secret" },
			CaseMaterialBucket: { name: "linked-case-materials" },
			StudentCaseCompletionTable: { name: "linked-case-completions" },
			StudentCertificateTable: { name: "linked-certificates" },
			StudentQuizAttemptTable: { name: "linked-quiz-attempts" },
			TeacherCaseTable: { name: "linked-teacher-cases" },
			UserProfileTable: { name: "linked-user-profiles" },
		});
		vi.stubEnv("AUTH_E2E_MODE", "memory");
		vi.stubEnv("AUTH_USER_POOL_ID", "env-user-pool");
		vi.stubEnv("AUTH_USER_POOL_CLIENT_ID", "env-user-pool-client");
		vi.stubEnv("BETTER_AUTH_SECRET", "env-better-auth-secret");
		vi.stubEnv("CASE_MATERIAL_BUCKET_NAME", "env-case-materials");
		vi.stubEnv("STUDENT_CASE_COMPLETION_TABLE_NAME", "env-case-completions");
		vi.stubEnv("STUDENT_CERTIFICATE_TABLE_NAME", "env-certificates");
		vi.stubEnv("STUDENT_QUIZ_ATTEMPT_TABLE_NAME", "env-quiz-attempts");
		vi.stubEnv("TEACHER_CASE_TABLE_NAME", "env-teacher-cases");
		vi.stubEnv("USER_PROFILE_TABLE_NAME", "env-user-profiles");
		vi.stubEnv("REGISTRATION_WORKFLOW_TABLE_NAME", "env-registration-workflow");
		vi.stubEnv("RESEND_API_KEY", "env-resend-key");
		vi.stubEnv("CASE_ARCHIVE_SCHEDULE_GROUP_NAME", "env-schedule-group");
		vi.stubEnv("CASE_ARCHIVE_SCHEDULE_NAME", "env-schedule");
		vi.stubEnv(
			"CASE_ARCHIVE_SCHEDULER_ROLE_ARN",
			"arn:aws:iam::123456789012:role/env-scheduler",
		);
		vi.stubEnv(
			"CASE_ARCHIVE_TARGET_ARN",
			"arn:aws:lambda:me-central-1:123456789012:function:env-archive",
		);

		const {
			getActiveCaseArchiveScheduleResources,
			getAuthResources,
			getCaseNotificationResources,
			getSessionAuthResources,
		} = await import("./resources");

		expect(getSessionAuthResources()).toMatchObject({
			betterAuthSecret: "eccs-e2e-better-auth-secret-for-local-tests-only",
			caseMaterialBucketName: "e2e-case-material-bucket",
			studentCaseCompletionTableName: "e2e-student-case-completion-table",
			studentCertificateTableName: "e2e-student-certificate-table",
			studentQuizAttemptTableName: "e2e-student-quiz-attempt-table",
			teacherCaseTableName: "e2e-teacher-case-table",
			userPoolClientId: "e2e-auth-user-pool-client",
			userPoolId: "e2e-auth-user-pool",
			userProfileTableName: "e2e-user-profile-table",
		});
		expect(getAuthResources()).toMatchObject({
			registrationWorkflowTableName: "e2e-registration-workflow-table",
			resendApiKey: "e2e-resend-api-key",
		});
		expect(getCaseNotificationResources()).toMatchObject({
			resendApiKey: "e2e-resend-api-key",
			studentCertificateTableName: "e2e-student-certificate-table",
			teacherCaseTableName: "e2e-teacher-case-table",
			userProfileTableName: "e2e-user-profile-table",
		});
		expect(getActiveCaseArchiveScheduleResources()).toEqual({
			groupName: "default",
			roleArn: "arn:aws:iam::000000000000:role/e2e-active-case-archive",
			scheduleName: "e2e-active-case-archive",
			targetArn:
				"arn:aws:lambda:us-east-2:000000000000:function:e2e-active-case-archive",
		});
	});

	it("reports a missing explicit env or linked resource", async () => {
		const { getSessionAuthResources } = await import("./resources");

		expect(() => getSessionAuthResources()).toThrow(
			"AUTH_USER_POOL_ID or AuthUserPool.id",
		);
	});
});
