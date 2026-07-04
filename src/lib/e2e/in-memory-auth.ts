import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
	AuthSessionTokens,
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
	hasStudentCognitoGroup,
	type CognitoGroupName
} from "@/lib/auth/cognito-groups";

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
	  };

type E2EAuthStoreShape = {
	registrations: Map<string, PendingRegistrationRecord>;
	profiles: Map<string, StudentProfileRecord>;
	users: Map<
		string,
		{
			cognitoSub: string;
			enabled: boolean;
			groups: CognitoGroupName[];
			password: string;
			resetCode?: string;
			resetCodeConsumedAt?: number;
			resetRequestCount?: number;
			resetRequestWindowStartedAt?: number;
		}
	>;
	emails: E2EEmailRecord[];
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
	store.users.clear();
	store.emails = [];

	rmSync(EMAIL_STORE_PATH, { force: true });
}

export function isE2EMode(): boolean {
	return process.env.AUTH_E2E_MODE === "memory";
}

export class InMemoryIdentityProvider
	implements
		RegistrationIdentityProvider,
		LoginIdentityProvider,
		PasswordResetIdentityProvider
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
		user.groups = [COGNITO_GROUPS.student];
	}

	async deletePendingStudent(emailNormalized: string) {
		getStore().users.delete(emailNormalized);
	}

	async authenticateStudent(args: {
		emailNormalized: string;
		password: string;
	}): Promise<AuthSessionTokens> {
		const store = getStore();
		const user = store.users.get(args.emailNormalized);

		if (!user) {
			throw new InvalidLoginCredentialsError();
		}

		if (user.password !== args.password) {
			throw new InvalidLoginCredentialsError();
		}

		if (!user.enabled) {
			throw new LoginBlockedUntilVerifiedError();
		}

		return {
			accessToken: `e2e-access-${args.emailNormalized}`,
			idToken: `e2e-id-${args.emailNormalized}`,
			refreshToken: `e2e-refresh-${args.emailNormalized}`,
			expiresIn: 3600
		};
	}

	async isStudentLoginEligible(args: { emailNormalized: string }) {
		const user = getStore().users.get(args.emailNormalized);

		return Boolean(user?.enabled && hasStudentCognitoGroup(user.groups));
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

	async invalidateCognitoSessions() {}
}

export class InMemoryRegistrationRepository
	implements
		RegistrationWorkflowRepository,
		LoginProfileRepository,
		PasswordResetProfileRepository,
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
		return getStore().profiles.has(emailNormalized);
	}

	async getStudentProfileById(profileId: string) {
		return (
			Array.from(getStore().profiles.values()).find(
				(profile) => profile.profileId === profileId
			) ?? null
		);
	}

	async getStudentProfileByEmail(emailNormalized: string) {
		return getStore().profiles.get(emailNormalized) ?? null;
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
			updatedAt: Math.floor(args.invalidatedAt / 1000)
		});
	}
}

export class InMemoryEmailSender
	implements RegistrationEmailSender, PasswordResetEmailSender
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
