import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
	AuthSessionTokens,
	LoginAuthenticationResult,
	LoginIdentityProvider,
	LoginProfileRepository
} from "@/features/auth/login/service";
import {
	InvalidLoginCredentialsError,
	LoginBlockedUntilVerifiedError
} from "@/features/auth/login/service";
import type {
	AppSessionInvalidator,
	PasswordResetIdentityProvider,
	PasswordResetProfileRepository
} from "@/features/auth/password-reset/service";
import {
	InvalidPasswordResetCodeError,
	PasswordResetDeliveryUnavailableError,
	PasswordResetRateLimitedError,
	PasswordResetUserNotFoundError
} from "@/features/auth/password-reset/service";
import type { PasswordResetEmailSender } from "@/features/auth/password-reset/email";
import type {
	CreatePendingStudentInput,
	CreatePendingStudentResult,
	RegistrationIdentityProvider
} from "@/features/auth/registration/identity";
import { StudentAlreadyExistsError } from "@/features/auth/registration/identity";
import type { RegistrationEmailSender } from "@/features/auth/registration/email";
import type {
	AppProfileRecord,
	PendingRegistrationRecord,
	RegistrationWorkflowRepository,
	StudentProfileRecord
} from "@/features/auth/registration/repository";
import {
	VerificationResendLimitExceededError,
	VerificationTokenAlreadyConsumedError
} from "@/features/auth/registration/repository";
import {
	COGNITO_GROUPS,
	type CognitoGroupName
} from "@/lib/auth/cognito-groups";
import {
	ProfileSecurityEmailUnavailableError,
	type ProfileSecurityEmailSender,
	type ProfileSecurityIdentityProvider,
	type ProfileSecurityRepository
} from "@/features/profile-security/service";
import type { CaseDraft } from "@/features/teacher/case-authoring/schema";

export type E2EEmailRecord =
	| {
			type: "registration_verification";
			to: string;
			firstName: string;
			verificationUrl: string;
			expiresInHours: number;
			sentAt: number;
	  }
	| {
			type: "password_reset";
			to: string;
			resetUrl: string;
			expiresInMinutes: number;
			sentAt: number;
	  }
	| {
			type: "password_changed";
			to: string;
			sentAt: number;
	  }
	| {
			type: "email_change_verification";
			to: string;
			verificationUrl: string;
			expiresInHours: number;
			sentAt: number;
	  };

type E2EAuthStoreShape = {
	registrations: Map<string, PendingRegistrationRecord>;
	profiles: Map<string, AppProfileRecord>;
	teacherCases: Map<
		string,
		{
			caseId: string;
			title: string;
			lifecycle: "published" | "archived" | "draft";
			publishedAt: number;
			deadlineAt: number;
			archivedAt?: number;
			draft?: CaseDraft;
			teacherProfileId?: string;
			completionCount: number;
			feedbackCount: number;
		}
	>;
	teacherCaseDrafts: Map<string, E2ETeacherCaseDraftRecord>;
	users: Map<
		string,
		{
			cognitoSub: string;
			enabled: boolean;
			emailVerified: boolean;
			groups: CognitoGroupName[];
			password: string;
			forcePasswordChange?: boolean;
			challengeSession?: string;
			resetCode?: string;
			resetCodeConsumedAt?: number;
			resetRequestCount?: number;
			resetRequestWindowStartedAt?: number;
		}
	>;
	emails: E2EEmailRecord[];
};

export type E2ETeacherCaseDraftRecord = {
	caseId: string;
	draft: CaseDraft;
	teacherProfileId: string;
	title: string;
	updatedAt: number;
};

const GLOBAL_KEY = "__E2E_AUTH_STORE__";
const EMAIL_STORE_PATH =
	process.env.ECCS_E2E_EMAIL_STORE_PATH ??
	join(tmpdir(), "eccs-ai-e2e-auth-emails.json");

function getStore(): E2EAuthStoreShape {
	const processStore = process as NodeJS.Process & Record<string, unknown>;

	if (!processStore[GLOBAL_KEY]) {
		processStore[GLOBAL_KEY] = {
			registrations: new Map(),
			profiles: new Map(),
			teacherCases: new Map(),
			teacherCaseDrafts: new Map(),
			users: new Map(),
			emails: []
		};
	}

	return processStore[GLOBAL_KEY] as E2EAuthStoreShape;
}

export function getE2EAuthStore() {
	return getStore();
}

export function resetE2EAuthStore() {
	const store = getStore();

	store.registrations.clear();
	store.profiles.clear();
	store.teacherCases.clear();
	store.teacherCaseDrafts.clear();
	store.users.clear();
	store.emails = [];

	rmSync(EMAIL_STORE_PATH, { force: true });
}

export function isE2EMode(): boolean {
	return process.env.AUTH_E2E_MODE === "memory";
}

export function getE2ETeacherCaseStore() {
	return Array.from(getStore().teacherCases.values());
}

export function seedE2ETeacherCases(
	cases: Array<{
		caseId: string;
		title: string;
		lifecycle: "published" | "archived" | "draft";
		publishedAt: number;
		deadlineAt: number;
		archivedAt?: number;
		draft?: CaseDraft;
		teacherProfileId?: string;
		completionCount: number;
		feedbackCount: number;
	}>,
) {
	const store = getStore();

	store.teacherCases.clear();

	for (const caseRecord of cases) {
		store.teacherCases.set(caseRecord.caseId, caseRecord);
	}
}

export function saveE2ETeacherCaseRecord(record: {
	caseId: string;
	title: string;
	lifecycle: "published" | "archived" | "draft";
	publishedAt: number;
	deadlineAt: number;
	archivedAt?: number;
	draft?: CaseDraft;
	teacherProfileId?: string;
	completionCount: number;
	feedbackCount: number;
}) {
	getStore().teacherCases.set(record.caseId, record);
}

export function deleteE2ETeacherCaseDraftRecord(
	teacherProfileId: string,
	caseId: string,
) {
	const store = getStore();
	const record = store.teacherCaseDrafts.get(caseId);

	if (record?.teacherProfileId === teacherProfileId) {
		store.teacherCaseDrafts.delete(caseId);
	}
}

export function getE2ETeacherCaseDraftRecord(
	teacherProfileId: string,
	caseId?: string,
) {
	const records = listE2ETeacherCaseDraftRecords(teacherProfileId);

	if (caseId) {
		return records.find((record) => record.caseId === caseId) ?? null;
	}

	return records[0] ?? null;
}

export function listE2ETeacherCaseDraftRecords(teacherProfileId: string) {
	return Array.from(getStore().teacherCaseDrafts.values())
		.filter((record) => record.teacherProfileId === teacherProfileId)
		.sort((first, second) => second.updatedAt - first.updatedAt);
}

export function saveE2ETeacherCaseDraftRecord(
	record: E2ETeacherCaseDraftRecord,
) {
	getStore().teacherCaseDrafts.set(record.caseId, record);
}

export class InMemoryIdentityProvider
	implements
		RegistrationIdentityProvider,
		LoginIdentityProvider,
		PasswordResetIdentityProvider,
		ProfileSecurityIdentityProvider
{
	async createPendingStudent(
		input: CreatePendingStudentInput
	): Promise<CreatePendingStudentResult> {
		const store = getStore();

		if (store.users.has(input.emailNormalized)) {
			throw new StudentAlreadyExistsError();
		}

		const cognitoSub = `e2e-sub-${input.emailNormalized}`;

		store.users.set(input.emailNormalized, {
			cognitoSub,
			enabled: false,
			emailVerified: false,
			groups: [],
			password: input.password
		});

		return { cognitoSub };
	}

	async confirmStudentEmail(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
	}) {
		const store = getStore();
		const user = store.users.get(args.emailNormalized);

		if (!user) {
			throw new Error("User not found");
		}

		user.enabled = true;
		user.emailVerified = true;
		user.groups = [COGNITO_GROUPS.student];
	}

	async deletePendingStudent(emailNormalized: string) {
		getStore().users.delete(emailNormalized);
	}

	async authenticateUser(args: {
		emailNormalized: string;
		password: string;
	}): Promise<LoginAuthenticationResult> {
		const store = getStore();
		const user = store.users.get(args.emailNormalized);

		if (!user) {
			throw new InvalidLoginCredentialsError();
		}

		if (user.password !== args.password) {
			throw new InvalidLoginCredentialsError();
		}

		if (!user.enabled || !user.emailVerified) {
			throw new LoginBlockedUntilVerifiedError();
		}

		if (user.forcePasswordChange) {
			user.challengeSession = `e2e-new-password-${args.emailNormalized}-${Date.now()}`;

			return {
				challengeName: "NEW_PASSWORD_REQUIRED",
				challengeSession: user.challengeSession,
			};
		}

		return {
			accessToken: `e2e-access-${args.emailNormalized}`,
			idToken: `e2e-id-${args.emailNormalized}`,
			refreshToken: `e2e-refresh-${args.emailNormalized}`,
			expiresIn: 3600
		};
	}

	async completeNewPasswordChallenge(args: {
		emailNormalized: string;
		newPassword: string;
		challengeSession: string;
	}): Promise<AuthSessionTokens> {
		const user = getStore().users.get(args.emailNormalized);

		if (
			!user ||
			!user.enabled ||
			!user.emailVerified ||
			!user.forcePasswordChange ||
			user.challengeSession !== args.challengeSession
		) {
			throw new InvalidLoginCredentialsError();
		}

		user.password = args.newPassword;
		user.forcePasswordChange = false;
		user.challengeSession = undefined;

		return {
			accessToken: `e2e-access-${args.emailNormalized}`,
			idToken: `e2e-id-${args.emailNormalized}`,
			refreshToken: `e2e-refresh-${args.emailNormalized}`,
			expiresIn: 3600,
		};
	}

	async isStudentLoginEligible(args: { emailNormalized: string }) {
		return this.isRoleLoginEligible({
			emailNormalized: args.emailNormalized,
			role: "student",
		});
	}

	async isRoleLoginEligible(args: {
		emailNormalized: string;
		role: "student" | "teacher";
	}) {
		const user = getStore().users.get(args.emailNormalized);

		return Boolean(
			user?.enabled &&
				user.emailVerified &&
				user.groups.includes(COGNITO_GROUPS[args.role])
		);
	}

	async requestPasswordReset(args: { emailNormalized: string }) {
		const user = getStore().users.get(args.emailNormalized);

		if (!user) {
			throw new PasswordResetUserNotFoundError();
		}

		if (!user.enabled) {
			throw new PasswordResetDeliveryUnavailableError();
		}

		const now = Math.floor(Date.now() / 1000);
		const windowStartedAt = user.resetRequestWindowStartedAt ?? now;
		const isNewWindow = now - windowStartedAt >= 60 * 60;
		const requestCount = isNewWindow ? 0 : (user.resetRequestCount ?? 0);

		if (requestCount >= 5) {
			throw new PasswordResetRateLimitedError();
		}

		const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

		user.resetCode = resetCode;
		user.resetCodeConsumedAt = undefined;
		user.resetRequestCount = requestCount + 1;
		user.resetRequestWindowStartedAt = isNewWindow ? now : windowStartedAt;

		return { resetCode };
	}

	async confirmPasswordReset(args: {
		emailNormalized: string;
		code: string;
		newPassword: string;
	}) {
		const user = getStore().users.get(args.emailNormalized);

		if (!user) {
			throw new PasswordResetUserNotFoundError();
		}

		if (
			!user.resetCode ||
			user.resetCode !== args.code ||
			user.resetCodeConsumedAt
		) {
			throw new InvalidPasswordResetCodeError();
		}

		user.password = args.newPassword;
		user.resetCodeConsumedAt = Date.now();
	}

	async invalidateCognitoSessions(args: { emailNormalized: string }) {
		void args;
	}

	async updateProfileName(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}) {
		void args;
	}

	async updateProfileEmail(args: {
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}) {
		const store = getStore();
		const user = store.users.get(args.currentEmailNormalized);

		if (!user) {
			throw new Error("User not found");
		}

		if (store.users.has(args.newEmailNormalized)) {
			throw new ProfileSecurityEmailUnavailableError();
		}

		store.users.delete(args.currentEmailNormalized);
		store.users.set(args.newEmailNormalized, user);
	}

	async setProfilePassword(args: {
		emailNormalized: string;
		password: string;
	}) {
		const user = getStore().users.get(args.emailNormalized);

		if (!user) {
			throw new Error("User not found");
		}

		user.password = args.password;
	}

	async updateStudentName(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}) {
		await this.updateProfileName(args);
	}

	async updateStudentEmail(args: {
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}) {
		await this.updateProfileEmail(args);
	}

	async setStudentPassword(args: {
		emailNormalized: string;
		password: string;
	}) {
		await this.setProfilePassword(args);
	}
}

export class InMemoryRegistrationRepository
	implements
		RegistrationWorkflowRepository,
		LoginProfileRepository,
		PasswordResetProfileRepository,
		ProfileSecurityRepository,
		AppSessionInvalidator
{
	async getPendingByEmail(emailNormalized: string) {
		return getStore().registrations.get(emailNormalized) ?? null;
	}

	async createPendingRegistration(record: PendingRegistrationRecord) {
		getStore().registrations.set(record.emailNormalized, record);
	}

	async addVerificationToken(
		emailNormalized: string,
		update: {
			previousVerificationTokenHash: string;
			verificationTokenHash: string;
			lastSentAt: number;
			updatedAt: number;
			maxSendsPerWindow: number;
		}
	) {
		const store = getStore();
		const existing = store.registrations.get(emailNormalized);

		if (!existing) {
			throw new Error("Missing registration");
		}

		if (existing.sendCount >= update.maxSendsPerWindow) {
			throw new VerificationResendLimitExceededError();
		}

		store.registrations.set(emailNormalized, {
			...existing,
			verificationTokenHash: update.verificationTokenHash,
			verificationTokenHashes: [
				...(existing.verificationTokenHashes ?? [
					update.previousVerificationTokenHash,
				]),
				update.verificationTokenHash,
			],
			sendCount: existing.sendCount + 1,
			lastSentAt: update.lastSentAt,
			updatedAt: update.updatedAt,
		});
	}

	async findPendingByTokenHash(verificationTokenHash: string) {
		return (
			Array.from(getStore().registrations.values()).find(
				(record) =>
					record.verificationTokenHash === verificationTokenHash ||
					record.verificationTokenHashes?.includes(verificationTokenHash)
			) ?? null
		);
	}

	async consumeVerificationToken(args: {
		emailNormalized: string;
		verificationTokenHash: string;
		consumedAt: number;
	}) {
		const store = getStore();
		const existing = store.registrations.get(args.emailNormalized);

		if (
			!existing ||
			existing.consumedAt ||
			!(
				existing.verificationTokenHash === args.verificationTokenHash ||
				existing.verificationTokenHashes?.includes(args.verificationTokenHash)
			)
		) {
			throw new VerificationTokenAlreadyConsumedError();
		}

		store.registrations.set(args.emailNormalized, {
			...existing,
			consumedAt: args.consumedAt,
			status: "verified",
			updatedAt: args.consumedAt
		});
	}

	async upsertStudentProfile(profile: StudentProfileRecord) {
		await this.upsertAppProfile(profile);
	}

	async upsertAppProfile(profile: AppProfileRecord) {
		getStore().profiles.set(profile.emailNormalized, profile);
	}

	async listExpiredPendingRegistrations(args: { now: number; limit: number }) {
		return Array.from(getStore().registrations.values())
			.filter(
				(record) =>
					record.status === "pending" &&
					!record.consumedAt &&
					record.expiresAt <= args.now
			)
			.slice(0, args.limit);
	}

	async deletePendingRegistration(emailNormalized: string) {
		getStore().registrations.delete(emailNormalized);
	}

	async recordCleanupFailure() {}

	async hasStudentProfile(emailNormalized: string) {
		return this.hasAppProfile(emailNormalized);
	}

	async hasAppProfile(emailNormalized: string) {
		return getStore().profiles.has(emailNormalized);
	}

	async getStudentProfileById(profileId: string) {
		const profile = await this.getAppProfileById(profileId);

		return profile?.role === "student" ? profile : null;
	}

	async getAppProfileById(profileId: string) {
		return (
			Array.from(getStore().profiles.values()).find(
				(profile) => profile.profileId === profileId
			) ?? null
		);
	}

	async getStudentProfileByEmail(emailNormalized: string) {
		const profile = await this.getProfileByEmail(emailNormalized);

		return profile?.role === "student" ? profile : null;
	}

	async getProfileByEmail(emailNormalized: string) {
		return getStore().profiles.get(emailNormalized) ?? null;
	}

	async updateStudentName(args: {
		profileId: string;
		firstName: string;
		lastName: string;
		fullName: string;
		updatedAt: number;
	}) {
		await this.updateProfileName(args);
	}

	async updateProfileName(args: {
		profileId: string;
		firstName: string;
		lastName: string;
		fullName: string;
		updatedAt: number;
	}) {
		const store = getStore();
		const profile = Array.from(store.profiles.values()).find(
			(record) => record.profileId === args.profileId
		);

		if (!profile) {
			return;
		}

		store.profiles.set(profile.emailNormalized, {
			...profile,
			firstName: args.firstName,
			lastName: args.lastName,
			fullName: args.fullName,
			updatedAt: args.updatedAt
		});
	}

	async storePendingEmailChange(args: {
		profileId: string;
		pendingEmail: string;
		pendingEmailVerificationTokenHash: string;
		pendingEmailVerificationExpiresAt: number;
		pendingEmailVerificationRequestedAt: number;
		updatedAt: number;
	}) {
		const store = getStore();
		const profile = Array.from(store.profiles.values()).find(
			(record) => record.profileId === args.profileId
		);

		if (!profile) {
			return;
		}

		store.profiles.set(profile.emailNormalized, {
			...profile,
			pendingEmail: args.pendingEmail,
			pendingEmailVerificationTokenHash:
				args.pendingEmailVerificationTokenHash,
			pendingEmailVerificationExpiresAt:
				args.pendingEmailVerificationExpiresAt,
			pendingEmailVerificationRequestedAt:
				args.pendingEmailVerificationRequestedAt,
			updatedAt: args.updatedAt
		});
	}

	async findStudentProfileByPendingEmailTokenHash(tokenHash: string) {
		const profile = await this.findProfileByPendingEmailTokenHash(tokenHash);

		return profile?.role === "student" ? profile : null;
	}

	async findProfileByPendingEmailTokenHash(tokenHash: string) {
		return (
			Array.from(getStore().profiles.values()).find(
				(record) => record.pendingEmailVerificationTokenHash === tokenHash
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
		const store = getStore();
		const profile = store.profiles.get(args.currentEmailNormalized);

		if (!profile || profile.profileId !== args.profileId) {
			return;
		}

		store.profiles.delete(args.currentEmailNormalized);
		store.profiles.set(args.newEmailNormalized, {
			...profile,
			emailNormalized: args.newEmailNormalized,
			emailVerifiedAt: args.verifiedAt,
			pendingEmail: undefined,
			pendingEmailVerificationTokenHash: undefined,
			pendingEmailVerificationExpiresAt: undefined,
			pendingEmailVerificationRequestedAt: undefined,
			sessionsInvalidatedAt: args.sessionsInvalidatedAt,
			sessionInvalidationExemptToken:
				args.sessionInvalidationExemptToken,
			updatedAt: args.verifiedAt
		});
	}

	async invalidateOtherSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
		updatedAt: number;
		sessionInvalidationExemptToken?: string;
	}) {
		const store = getStore();
		const profile = Array.from(store.profiles.values()).find(
			(record) => record.profileId === args.userId
		);

		if (!profile) {
			return;
		}

		store.profiles.set(profile.emailNormalized, {
			...profile,
			sessionsInvalidatedAt: args.invalidatedAt,
			sessionInvalidationExemptToken:
				args.sessionInvalidationExemptToken,
			updatedAt: args.updatedAt
		});
	}

	async invalidateSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
	}) {
		const store = getStore();
		const profile = Array.from(store.profiles.values()).find(
			(record) => record.profileId === args.userId
		);

		if (!profile) {
			return;
		}

		store.profiles.set(profile.emailNormalized, {
			...profile,
			sessionsInvalidatedAt: args.invalidatedAt,
			sessionInvalidationExemptToken: undefined,
			updatedAt: Math.floor(args.invalidatedAt / 1000)
		});
	}
}

export function bootstrapE2ETeacher(input: {
	email: string;
	firstName: string;
	lastName: string;
	temporaryPassword: string;
	emailVerified?: boolean;
	forcePasswordChange?: boolean;
}) {
	const store = getStore();
	const emailNormalized = input.email.trim().toLowerCase();
	const now = Math.floor(Date.now() / 1000);
	const cognitoSub = `e2e-sub-${emailNormalized}`;
	const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

	store.users.set(emailNormalized, {
		cognitoSub,
		enabled: true,
		emailVerified: input.emailVerified ?? true,
		groups: [COGNITO_GROUPS.teacher],
		password: input.temporaryPassword,
		forcePasswordChange: input.forcePasswordChange ?? true,
	});
	store.profiles.set(emailNormalized, {
		profileId: cognitoSub,
		emailNormalized,
		firstName: input.firstName.trim(),
		lastName: input.lastName.trim(),
		fullName,
		role: "teacher",
		emailVerifiedAt: input.emailVerified === false ? 0 : now,
		createdAt: now,
		updatedAt: now,
	});

	return {
		emailNormalized,
		profileId: cognitoSub,
	};
}

export class InMemoryEmailSender
	implements
		RegistrationEmailSender,
		PasswordResetEmailSender,
		ProfileSecurityEmailSender
{
	async sendRegistrationVerificationEmail(email: {
		to: string;
		firstName: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		const record = {
			type: "registration_verification" as const,
			...email,
			sentAt: Date.now()
		};

		getStore().emails.push(record);
		appendEmailRecord(record);
	}

	getLastVerificationUrl(emailNormalized: string): string | null {
		const store = getStore();
		const record = [...store.emails, ...readEmailRecords()]
			.reverse()
			.find(
				(e) =>
					e.type === "registration_verification" &&
					e.to === emailNormalized
			);

		return record && "verificationUrl" in record ? record.verificationUrl : null;
	}

	async sendPasswordResetCodeEmail(email: {
		to: string;
		resetUrl: string;
		expiresInMinutes: number;
	}) {
		const record = {
			type: "password_reset" as const,
			...email,
			sentAt: Date.now()
		};

		getStore().emails.push(record);
		appendEmailRecord(record);
	}

	async sendPasswordChangedEmail(email: { to: string }) {
		const record = {
			type: "password_changed" as const,
			...email,
			sentAt: Date.now()
		};

		getStore().emails.push(record);
		appendEmailRecord(record);
	}

	async sendEmailChangeVerificationEmail(email: {
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		const record = {
			type: "email_change_verification" as const,
			...email,
			sentAt: Date.now()
		};

		getStore().emails.push(record);
		appendEmailRecord(record);
	}

	getLastPasswordResetUrl(emailNormalized: string): string | null {
		const store = getStore();
		const record = [...store.emails, ...readEmailRecords()]
			.reverse()
			.find((e) => e.type === "password_reset" && e.to === emailNormalized);

		return record && "resetUrl" in record ? record.resetUrl : null;
	}

	hasPasswordChangedEmail(emailNormalized: string): boolean {
		const store = getStore();

		return [...store.emails, ...readEmailRecords()].some(
			(e) => e.type === "password_changed" && e.to === emailNormalized
		);
	}

	getLastEmailChangeVerificationUrl(emailNormalized: string): string | null {
		const store = getStore();
		const record = [...store.emails, ...readEmailRecords()]
			.reverse()
			.find(
				(e) =>
					e.type === "email_change_verification" &&
					e.to === emailNormalized
			);

		return record && "verificationUrl" in record ? record.verificationUrl : null;
	}
}

function readEmailRecords(): E2EEmailRecord[] {
	try {
		const raw = readFileSync(EMAIL_STORE_PATH, "utf8");
		const parsed = JSON.parse(raw);

		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function appendEmailRecord(record: E2EEmailRecord) {
	const records = readEmailRecords();

	mkdirSync(dirname(EMAIL_STORE_PATH), { recursive: true });
	writeFileSync(
		EMAIL_STORE_PATH,
		JSON.stringify([...records, record], null, 2),
		"utf8"
	);
}

let sharedIdentity: InMemoryIdentityProvider | undefined;
let sharedRepository: InMemoryRegistrationRepository | undefined;
let sharedEmail: InMemoryEmailSender | undefined;

export function getE2EAdapters() {
	if (!sharedIdentity) {
		sharedIdentity = new InMemoryIdentityProvider();
		sharedRepository = new InMemoryRegistrationRepository();
		sharedEmail = new InMemoryEmailSender();
	}

	return {
		identity: sharedIdentity,
		repository: sharedRepository!,
		email: sharedEmail!
	};
}
