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
	VerificationTokenAlreadyConsumedError
} from "@/features/auth/registration/repository";

export type E2EEmailRecord = {
	to: string;
	firstName: string;
	verificationUrl: string;
	expiresInHours: number;
	sentAt: number;
};

type E2EAuthStoreShape = {
	registrations: Map<string, PendingRegistrationRecord>;
	profiles: Map<string, StudentProfileRecord>;
	users: Map<string, { cognitoSub: string; enabled: boolean; password: string }>;
	emails: E2EEmailRecord[];
};

const GLOBAL_KEY = "__E2E_AUTH_STORE__";

function getStore(): E2EAuthStoreShape {
	if (!(globalThis as Record<string, unknown>)[GLOBAL_KEY]) {
		(globalThis as Record<string, unknown>)[GLOBAL_KEY] = {
			registrations: new Map(),
			profiles: new Map(),
			users: new Map(),
			emails: []
		};
	}

	return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as E2EAuthStoreShape;
}

export function getE2EAuthStore() {
	return getStore();
}

export function isE2EMode(): boolean {
	return process.env.AUTH_E2E_MODE === "memory";
}

export class InMemoryIdentityProvider
	implements RegistrationIdentityProvider, LoginIdentityProvider
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
}

export class InMemoryRegistrationRepository
	implements RegistrationWorkflowRepository, LoginProfileRepository
{
	async getPendingByEmail(emailNormalized: string) {
		return getStore().registrations.get(emailNormalized) ?? null;
	}

	async createPendingRegistration(record: PendingRegistrationRecord) {
		getStore().registrations.set(record.emailNormalized, record);
	}

	async replaceVerificationToken(
		emailNormalized: string,
		update: Pick<
			PendingRegistrationRecord,
			| "verificationTokenHash"
			| "expiresAt"
			| "sendCount"
			| "lastSentAt"
			| "rateLimitWindowStartedAt"
			| "updatedAt"
			| "ttl"
		>
	) {
		const store = getStore();
		const existing = store.registrations.get(emailNormalized);

		if (!existing) {
			throw new Error("Missing registration");
		}

		store.registrations.set(emailNormalized, { ...existing, ...update });
	}

	async findPendingByTokenHash(verificationTokenHash: string) {
		return (
			Array.from(getStore().registrations.values()).find(
				(record) => record.verificationTokenHash === verificationTokenHash
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
			existing.verificationTokenHash !== args.verificationTokenHash
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
}

export class InMemoryEmailSender implements RegistrationEmailSender {
	async sendRegistrationVerificationEmail(email: {
		to: string;
		firstName: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		getStore().emails.push({
			...email,
			sentAt: Date.now()
		});
	}

	getLastVerificationUrl(emailNormalized: string): string | null {
		const store = getStore();
		const record = [...store.emails]
			.reverse()
			.find((e) => e.to === emailNormalized);

		return record?.verificationUrl ?? null;
	}
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
