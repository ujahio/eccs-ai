import { describe, expect, it } from "vitest";
import { InvalidLoginCredentialsError } from "@/features/auth/login/service";
import type { StudentProfileRecord } from "@/features/auth/registration/repository";
import { hashVerificationToken } from "@/features/auth/registration/tokens";
import {
	StudentEmailUnavailableError,
	StudentProfileService,
	type StudentProfileEmailSender,
	type StudentProfileIdentityProvider,
	type StudentProfileRepository,
} from "./service";

const baseProfile: StudentProfileRecord = {
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

class FakeIdentity implements StudentProfileIdentityProvider {
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

	async updateStudentName(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}) {
		this.nameUpdates.push(args);
	}

	async authenticateStudent(args: {
		emailNormalized: string;
		password: string;
	}) {
		this.authentications.push(args);

		if (this.invalidPassword) {
			throw new InvalidLoginCredentialsError();
		}

		return {};
	}

	async updateStudentEmail(args: {
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}) {
		if (this.emailUnavailable) {
			throw new StudentEmailUnavailableError();
		}

		this.emailUpdates.push(args);
	}

	async setStudentPassword(args: {
		emailNormalized: string;
		password: string;
	}) {
		this.passwordUpdates.push(args);
	}

	async invalidateCognitoSessions(args: { emailNormalized: string }) {
		this.globalSignOuts.push(args.emailNormalized);
	}
}

class FakeProfiles implements StudentProfileRepository {
	records = new Map<string, StudentProfileRecord>([
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
	}> = [];
	sessionInvalidations: Array<{
		userId: string;
		invalidatedAt: number;
		updatedAt: number;
		sessionInvalidationExemptToken?: string;
	}> = [];

	async getStudentProfileByEmail(emailNormalized: string) {
		return this.records.get(emailNormalized) ?? null;
	}

	async updateStudentName(args: {
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

	async findStudentProfileByPendingEmailTokenHash(tokenHash: string) {
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

class FakeEmail implements StudentProfileEmailSender {
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
	const service = new StudentProfileService(identity, profiles, email, {
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

describe("StudentProfileService", () => {
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
				currentPassword: "casework1",
				password: "newcase1",
				confirmPassword: "newcase1",
			},
		});

		expect(result).toEqual({
			status: "password_changed",
			message: "Your password was changed.",
		});
		expect(identity.authentications).toEqual([
			{
				emailNormalized: "student@example.com",
				password: "casework1",
			},
		]);
		expect(identity.passwordUpdates).toEqual([
			{
				emailNormalized: "student@example.com",
				password: "newcase1",
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
				password: "newcase1",
				confirmPassword: "newcase1",
			},
		});

		expect(result).toEqual({
			status: "invalid_current_password",
			message: "Enter your current password.",
		});
		expect(identity.passwordUpdates).toEqual([]);
	});
});
