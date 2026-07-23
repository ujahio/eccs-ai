import { describe, expect, it } from "vitest";
import { InvalidLoginCredentialsError } from "@/features/auth/login/service";
import type {
	AppProfileRecord,
	TeacherProfileRecord,
} from "@/features/auth/registration/repository";
import { hashVerificationToken } from "@/features/auth/registration/tokens";
import {
	ProfileSecurityEmailUnavailableError,
	ProfileSecurityService,
	type ProfileSecurityEmailSender,
	type ProfileSecurityIdentityProvider,
	type ProfileSecurityRepository,
} from "./service";

const baseProfile: AppProfileRecord = {
	profileId: "profile-1",
	emailNormalized: "student@example.com",
	firstName: "Jordan",
	lastName: "Adebayo",
	fullName: "Jordan Adebayo",
	role: "student",
	emailVerifiedAt: 500,
	canAccessCases: true,
	createdAt: 500,
	updatedAt: 500,
};

const teacherProfile: TeacherProfileRecord = {
	profileId: "teacher-profile-1",
	emailNormalized: "teacher@example.com",
	firstName: "Taylor",
	lastName: "Smith",
	fullName: "Taylor Smith",
	role: "teacher",
	emailVerifiedAt: 500,
	createdAt: 500,
	updatedAt: 500,
};

class FakeIdentity implements ProfileSecurityIdentityProvider {
	nameUpdates: Array<{
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}> = [];
	emailUpdates: Array<{
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}> = [];
	passwordUpdates: Array<{ emailNormalized: string; password: string }> = [];
	authentications: Array<{ emailNormalized: string; password: string }> = [];
	globalSignOuts: string[] = [];
	invalidPassword = false;
	emailUnavailable = false;

	async updateProfileName(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}) {
		this.nameUpdates.push(args);
	}

	async authenticateUser(args: {
		emailNormalized: string;
		password: string;
	}) {
		this.authentications.push(args);

		if (this.invalidPassword) {
			throw new InvalidLoginCredentialsError();
		}

		return {};
	}

	async updateProfileEmail(args: {
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}) {
		if (this.emailUnavailable) {
			throw new ProfileSecurityEmailUnavailableError();
		}

		this.emailUpdates.push(args);
	}

	async setProfilePassword(args: {
		emailNormalized: string;
		password: string;
	}) {
		this.passwordUpdates.push(args);
	}

	async invalidateCognitoSessions(args: { emailNormalized: string }) {
		this.globalSignOuts.push(args.emailNormalized);
	}
}

class FakeProfiles implements ProfileSecurityRepository {
	records = new Map<string, AppProfileRecord>([
		[baseProfile.emailNormalized, baseProfile],
	]);
	nameUpdates: Array<{
		profileId: string;
		firstName: string;
		lastName: string;
		fullName: string;
		updatedAt: number;
	}> = [];
	pendingEmailUpdates: Array<{
		profileId: string;
		pendingEmail: string;
		pendingEmailVerificationTokenHash: string;
		pendingEmailVerificationExpiresAt: number;
		pendingEmailVerificationRequestedAt: number;
		updatedAt: number;
	}> = [];
	completedEmailChanges: Array<{
		profileId: string;
		currentEmailNormalized: string;
		newEmailNormalized: string;
		verifiedAt: number;
		sessionsInvalidatedAt: number;
		sessionInvalidationExemptToken?: string;
	}> = [];
	sessionInvalidations: Array<{
		userId: string;
		invalidatedAt: number;
		updatedAt: number;
		sessionInvalidationExemptToken?: string;
	}> = [];

	async getProfileByEmail(emailNormalized: string) {
		return this.records.get(emailNormalized) ?? null;
	}

	async updateProfileName(args: {
		profileId: string;
		firstName: string;
		lastName: string;
		fullName: string;
		updatedAt: number;
	}) {
		this.nameUpdates.push(args);
		const existing = this.findById(args.profileId);
		if (existing) {
			this.records.set(existing.emailNormalized, {
				...existing,
				firstName: args.firstName,
				lastName: args.lastName,
				fullName: args.fullName,
				updatedAt: args.updatedAt,
			});
		}
	}

	async storePendingEmailChange(args: {
		profileId: string;
		pendingEmail: string;
		pendingEmailVerificationTokenHash: string;
		pendingEmailVerificationExpiresAt: number;
		pendingEmailVerificationRequestedAt: number;
		updatedAt: number;
	}) {
		this.pendingEmailUpdates.push(args);
		const existing = this.findById(args.profileId);
		if (existing) {
			this.records.set(existing.emailNormalized, {
				...existing,
				pendingEmail: args.pendingEmail,
				pendingEmailVerificationTokenHash:
					args.pendingEmailVerificationTokenHash,
				pendingEmailVerificationExpiresAt:
					args.pendingEmailVerificationExpiresAt,
				pendingEmailVerificationRequestedAt:
					args.pendingEmailVerificationRequestedAt,
				updatedAt: args.updatedAt,
			});
		}
	}

	async findProfileByPendingEmailTokenHash(tokenHash: string) {
		return (
			Array.from(this.records.values()).find(
				(record) => record.pendingEmailVerificationTokenHash === tokenHash,
			) ?? null
		);
	}

	async completePendingEmailChange(args: {
		profileId: string;
		currentEmailNormalized: string;
		newEmailNormalized: string;
		verifiedAt: number;
		sessionsInvalidatedAt: number;
		sessionInvalidationExemptToken?: string;
	}) {
		this.completedEmailChanges.push(args);
		const existing = this.records.get(args.currentEmailNormalized);
		if (existing) {
			this.records.delete(args.currentEmailNormalized);
			this.records.set(args.newEmailNormalized, {
				...existing,
				emailNormalized: args.newEmailNormalized,
				emailVerifiedAt: args.verifiedAt,
				pendingEmail: undefined,
				pendingEmailVerificationTokenHash: undefined,
				pendingEmailVerificationExpiresAt: undefined,
				pendingEmailVerificationRequestedAt: undefined,
				sessionsInvalidatedAt: args.sessionsInvalidatedAt,
				sessionInvalidationExemptToken:
					args.sessionInvalidationExemptToken,
				updatedAt: args.verifiedAt,
			});
		}
	}

	async invalidateOtherSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
		updatedAt: number;
		sessionInvalidationExemptToken?: string;
	}) {
		this.sessionInvalidations.push(args);
	}

	private findById(profileId: string) {
		return Array.from(this.records.values()).find(
			(record) => record.profileId === profileId,
		);
	}
}

class FakeEmail implements ProfileSecurityEmailSender {
	emailChangeEmails: Array<{
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}> = [];
	passwordChangedEmails: Array<{ to: string }> = [];

	async sendEmailChangeVerificationEmail(email: {
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		this.emailChangeEmails.push(email);
	}

	async sendPasswordChangedEmail(email: { to: string }) {
		this.passwordChangedEmails.push(email);
	}
}

function createHarness(options: {
	nowSeconds?: number;
	nowMilliseconds?: number;
	tokens?: string[];
} = {}) {
	const identity = new FakeIdentity();
	const profiles = new FakeProfiles();
	const email = new FakeEmail();
	let nowSeconds = options.nowSeconds ?? 1_000;
	let nowMilliseconds = options.nowMilliseconds ?? 1_000_000;
	const tokens = [...(options.tokens ?? ["email-token"])];
	const service = new ProfileSecurityService(identity, profiles, email, {
		appBaseUrl: "https://eccs.example",
		nowSeconds: () => nowSeconds,
		nowMilliseconds: () => nowMilliseconds,
		generateToken: () => tokens.shift() ?? "fallback-token",
	});

	return {
		email,
		identity,
		profiles,
		service,
		setNowSeconds(value: number) {
			nowSeconds = value;
		},
		setNowMilliseconds(value: number) {
			nowMilliseconds = value;
		},
	};
}

describe("ProfileSecurityService", () => {
	it("updates the student name in identity and profile storage", async () => {
		const { identity, profiles, service } = createHarness();

		const result = await service.updateName(baseProfile, {
			firstName: " Alex ",
			lastName: " Chen ",
		});

		expect(result).toEqual({
			status: "name_updated",
			message: "Your name has been updated.",
		});
		expect(identity.nameUpdates).toEqual([
			{
				emailNormalized: "student@example.com",
				firstName: "Alex",
				lastName: "Chen",
				fullName: "Alex Chen",
			},
		]);
		expect(profiles.nameUpdates).toEqual([
			{
				profileId: "profile-1",
				firstName: "Alex",
				lastName: "Chen",
				fullName: "Alex Chen",
				updatedAt: 1_000,
			},
		]);
	});

	it("stores a pending email change without changing the current email", async () => {
		const { email, profiles, service } = createHarness({
			tokens: ["change-email-token"],
		});

		const result = await service.requestEmailChange(baseProfile, {
			email: "New.Student@Example.COM",
		});

		expect(result).toEqual({
			status: "verification_sent",
			message: "We sent a verification link to your new email address.",
			pendingEmail: "new.student@example.com",
		});
		expect(profiles.records.get("student@example.com")).toMatchObject({
			emailNormalized: "student@example.com",
			pendingEmail: "new.student@example.com",
			pendingEmailVerificationTokenHash: hashVerificationToken(
				"change-email-token",
			),
			pendingEmailVerificationExpiresAt: 87_400,
		});
		expect(profiles.records.has("new.student@example.com")).toBe(false);
		expect(email.emailChangeEmails).toHaveLength(1);
		expect(email.emailChangeEmails[0]).toMatchObject({
			to: "new.student@example.com",
			expiresInHours: 24,
		});
		expect(email.emailChangeEmails[0].verificationUrl).toContain(
			"/verify-email-change?token=",
		);
	});

	it("rejects same-email and already-used email change requests", async () => {
		const { profiles, service } = createHarness();
		profiles.records.set("taken@example.com", {
			...baseProfile,
			profileId: "profile-2",
			emailNormalized: "taken@example.com",
		});

		await expect(
			service.requestEmailChange(baseProfile, {
				email: "Student@Example.COM",
			}),
		).resolves.toMatchObject({
			status: "same_email",
		});
		await expect(
			service.requestEmailChange(baseProfile, {
				email: "taken@example.com",
			}),
		).resolves.toMatchObject({
			status: "email_unavailable",
			message:
				"We couldn't use that email address. Try another email or contact support.",
		});
	});

	it("completes an email change and requires sign-in with the new email", async () => {
		const { identity, profiles, service } = createHarness({
			tokens: ["verify-new-email"],
		});

		await service.requestEmailChange(baseProfile, {
			email: "new@example.com",
		});

		const result = await service.verifyEmailChange({
			token: "verify-new-email",
		});

		expect(result).toEqual({
			status: "verified_sign_in_required",
			message: "Your email address has been updated. Please sign in again.",
		});
		expect(identity.emailUpdates).toEqual([
			{
				currentEmailNormalized: "student@example.com",
				newEmailNormalized: "new@example.com",
			},
		]);
		expect(identity.globalSignOuts).toEqual(["new@example.com"]);
		expect(profiles.records.has("student@example.com")).toBe(false);
		expect(profiles.records.get("new@example.com")).toMatchObject({
			emailNormalized: "new@example.com",
			pendingEmail: undefined,
			sessionsInvalidatedAt: 1_000_000,
		});
	});

	it("keeps the current session when verifying from the matching profile session", async () => {
		const { profiles, service } = createHarness({
			tokens: ["verify-current-session"],
		});

		await service.requestEmailChange(baseProfile, {
			email: "kept@example.com",
		});

		const result = await service.verifyEmailChange({
			token: "verify-current-session",
			currentSession: {
				profileId: "profile-1",
				token: "current-session-token",
			},
		});

		expect(result).toMatchObject({
			status: "verified_current_session_kept",
			message: "Your email address has been updated.",
			profile: {
				profileId: "profile-1",
				emailNormalized: "kept@example.com",
				role: "student",
				sessionInvalidationExemptToken: "current-session-token",
				sessionsInvalidatedAt: 1_000_000,
			},
		});
		expect(profiles.completedEmailChanges).toEqual([
			{
				profileId: "profile-1",
				currentEmailNormalized: "student@example.com",
				newEmailNormalized: "kept@example.com",
				verifiedAt: 1_000,
				sessionsInvalidatedAt: 1_000_000,
				sessionInvalidationExemptToken: "current-session-token",
			},
		]);
		expect(profiles.records.get("kept@example.com")).toMatchObject({
			emailNormalized: "kept@example.com",
			sessionInvalidationExemptToken: "current-session-token",
		});
	});

	it("keeps the current teacher session when verifying a teacher email change", async () => {
		const { profiles, service } = createHarness({
			tokens: ["verify-teacher-session"],
		});
		profiles.records.set(teacherProfile.emailNormalized, teacherProfile);

		await service.requestEmailChange(teacherProfile, {
			email: "teacher-new@example.com",
		});

		const result = await service.verifyEmailChange({
			token: "verify-teacher-session",
			currentSession: {
				profileId: "teacher-profile-1",
				token: "teacher-session-token",
			},
		});

		expect(result).toMatchObject({
			status: "verified_current_session_kept",
			profile: {
				profileId: "teacher-profile-1",
				emailNormalized: "teacher-new@example.com",
				role: "teacher",
				sessionInvalidationExemptToken: "teacher-session-token",
			},
		});
		expect(profiles.records.get("teacher-new@example.com")).toMatchObject({
			role: "teacher",
			sessionInvalidationExemptToken: "teacher-session-token",
		});
	});

	it("expires pending email changes without mutating identity", async () => {
		const { identity, service, setNowSeconds } = createHarness({
			tokens: ["expired-token"],
		});

		await service.requestEmailChange(baseProfile, {
			email: "late@example.com",
		});
		setNowSeconds(87_400);

		const result = await service.verifyEmailChange({
			token: "expired-token",
		});

		expect(result).toEqual({
			status: "expired",
			message: "This email change link has expired.",
		});
		expect(identity.emailUpdates).toEqual([]);
	});

	it("changes password after verifying the current password", async () => {
		const { email, identity, profiles, service } = createHarness();

		const result = await service.changePassword({
			profile: baseProfile,
			currentSessionToken: "current-token",
			input: {
				currentPassword: "Casework1!",
				password: "Newcase1!",
				confirmPassword: "Newcase1!",
			},
		});

		expect(result).toEqual({
			status: "password_changed",
			message: "Your password was changed.",
		});
		expect(identity.authentications).toEqual([
			{
				emailNormalized: "student@example.com",
				password: "Casework1!",
			},
		]);
		expect(identity.passwordUpdates).toEqual([
			{
				emailNormalized: "student@example.com",
				password: "Newcase1!",
			},
		]);
		expect(identity.globalSignOuts).toEqual(["student@example.com"]);
		expect(profiles.sessionInvalidations).toEqual([
			{
				userId: "profile-1",
				invalidatedAt: 1_000_000,
				updatedAt: 1_000,
				sessionInvalidationExemptToken: "current-token",
			},
		]);
		expect(email.passwordChangedEmails).toEqual([
			{ to: "student@example.com" },
		]);
	});

	it("rejects password changes when the current password is invalid", async () => {
		const { identity, service } = createHarness();
		identity.invalidPassword = true;

		const result = await service.changePassword({
			profile: baseProfile,
			currentSessionToken: "current-token",
			input: {
				currentPassword: "wrongpass1",
				password: "Newcase1!",
				confirmPassword: "Newcase1!",
			},
		});

		expect(result).toEqual({
			status: "invalid_current_password",
			message: "Enter your current password.",
		});
		expect(identity.passwordUpdates).toEqual([]);
	});
});
