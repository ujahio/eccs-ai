import { describe, expect, it } from "vitest";
import {
	getExistingTeacherReconciliationBlocker,
	getSingleTeacherIdentityBlocker,
	getTemporaryPasswordValidationError,
	type CognitoUserState,
	type TeacherProfileRecord,
} from "./bootstrap-teacher";

function teacherProfile(
	overrides: Partial<TeacherProfileRecord> = {},
): TeacherProfileRecord {
	return {
		profileId: "teacher-sub",
		emailNormalized: "teacher@example.com",
		firstName: "Taylor",
		lastName: "Smith",
		fullName: "Taylor Smith",
		role: "teacher",
		emailVerifiedAt: 1,
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
}

function cognitoUser(overrides: Partial<CognitoUserState> = {}): CognitoUserState {
	return {
		username: "teacher@example.com",
		sub: "teacher-sub",
		enabled: true,
		status: "CONFIRMED",
		attributes: {
			sub: "teacher-sub",
			email: "teacher@example.com",
		},
		groups: [],
		...overrides,
	};
}

describe("bootstrap teacher single-teacher policy", () => {
	it("blocks bootstrapping a different email when a teacher profile already exists", () => {
		const blocker = getSingleTeacherIdentityBlocker({
			desiredEmailNormalized: "second@example.com",
			existingUser: null,
			teacherProfiles: [teacherProfile()],
			teacherUsers: [],
		});

		expect(blocker).toContain("exactly one teacher account/persona");
		expect(blocker).toContain("teacher@example.com");
	});

	it("blocks bootstrapping a different email when a Cognito teacher group user already exists", () => {
		const blocker = getSingleTeacherIdentityBlocker({
			desiredEmailNormalized: "second@example.com",
			existingUser: null,
			teacherProfiles: [],
			teacherUsers: [cognitoUser({ groups: ["teacher"] })],
		});

		expect(blocker).toContain("exactly one teacher account/persona");
		expect(blocker).toContain("Cognito teacher group user");
	});

	it("allows reconciling the same teacher identity", () => {
		const existingUser = cognitoUser({ groups: ["teacher"] });

		const blocker = getSingleTeacherIdentityBlocker({
			desiredEmailNormalized: "teacher@example.com",
			existingUser,
			teacherProfiles: [teacherProfile()],
			teacherUsers: [existingUser],
		});

		expect(blocker).toBeNull();
	});
});

describe("bootstrap teacher existing-user policy", () => {
	it("blocks granting teacher access to an existing non-teacher user", () => {
		const blocker = getExistingTeacherReconciliationBlocker({
			desiredEmailNormalized: "teacher@example.com",
			existingUser: cognitoUser(),
			existingProfile: null,
		});

		expect(blocker).toContain("not already a complete teacher identity");
		expect(blocker).toContain("only creates a brand-new teacher account");
	});

	it("blocks completing a partial teacher grant even when the Cognito user is in the teacher group", () => {
		const blocker = getExistingTeacherReconciliationBlocker({
			desiredEmailNormalized: "teacher@example.com",
			existingUser: cognitoUser({ groups: ["teacher"] }),
			existingProfile: null,
		});

		expect(blocker).toContain("not already a complete teacher identity");
		expect(blocker).toContain("no teacher profile");
	});

	it("blocks existing users even when Cognito already requires first-login password change", () => {
		const blocker = getExistingTeacherReconciliationBlocker({
			desiredEmailNormalized: "teacher@example.com",
			existingUser: cognitoUser({ status: "FORCE_CHANGE_PASSWORD" }),
			existingProfile: null,
		});

		expect(blocker).toContain("not already a complete teacher identity");
	});

	it("blocks existing users before password reset policy is considered", () => {
		const blocker = getExistingTeacherReconciliationBlocker({
			desiredEmailNormalized: "teacher@example.com",
			existingUser: cognitoUser(),
			existingProfile: null,
		});

		expect(blocker).toContain("not already a complete teacher identity");
	});

	it("allows idempotent reconciliation of an existing teacher after first login", () => {
		const blocker = getExistingTeacherReconciliationBlocker({
			desiredEmailNormalized: "teacher@example.com",
			existingUser: cognitoUser({ groups: ["teacher"] }),
			existingProfile: teacherProfile(),
		});

		expect(blocker).toBeNull();
	});

	it("allows password reset maintenance for an existing complete teacher identity", () => {
		const blocker = getExistingTeacherReconciliationBlocker({
			desiredEmailNormalized: "teacher@example.com",
			existingUser: cognitoUser({ groups: ["teacher"] }),
			existingProfile: teacherProfile(),
		});

		expect(blocker).toBeNull();
	});
});

describe("bootstrap teacher temporary password validation", () => {
	it("requires a Cognito-compliant temporary password", () => {
		expect(
			getTemporaryPasswordValidationError("Teacher1!", "TEACHER_TEMP_PASSWORD"),
		).toBeNull();
	});

	it("requires the full Cognito policy before sending the temporary password to Cognito", () => {
		const missingNumber = getTemporaryPasswordValidationError(
			"Longenough!",
			"TEACHER_TEMP_PASSWORD",
		);
		const missingLowercase = getTemporaryPasswordValidationError(
			"PASSWORD1!",
			"TEACHER_TEMP_PASSWORD",
		);
		const missingUppercase = getTemporaryPasswordValidationError(
			"password1!",
			"TEACHER_TEMP_PASSWORD",
		);
		const missingSymbol = getTemporaryPasswordValidationError(
			"Password1",
			"TEACHER_TEMP_PASSWORD",
		);
		const tooShort = getTemporaryPasswordValidationError(
			"Sho1!",
			"TEACHER_TEMP_PASSWORD",
		);

		expect(missingNumber).toContain("at least one number");
		expect(missingLowercase).toContain("at least one lowercase letter");
		expect(missingUppercase).toContain("at least one uppercase letter");
		expect(missingSymbol).toContain("at least one symbol");
		expect(tooShort).toContain("at least 8 characters");
	});

	it("explains that temporary passwords follow the repo Cognito password policy", () => {
		const validationError = getTemporaryPasswordValidationError(
			"teacher1",
			"TEACHER_TEMP_PASSWORD",
		);

		expect(validationError).toContain("Cognito password policy used in this repo");
		expect(validationError).toContain("at least one uppercase letter");
		expect(validationError).toContain("at least one symbol");
	});
});
