export type PendingRegistrationStatus = "pending" | "verified";

export type PendingRegistrationRecord = {
	emailNormalized: string;
	firstName: string;
	lastName: string;
	cognitoSub: string;
	verificationTokenHash: string;
	expiresAt: number;
	consumedAt?: number;
	sendCount: number;
	lastSentAt: number;
	rateLimitWindowStartedAt: number;
	createdAt: number;
	updatedAt: number;
	ttl: number;
	status: PendingRegistrationStatus;
	cleanupAttemptedAt?: number;
	cleanupError?: string;
};

export type StudentProfileRecord = {
	profileId: string;
	emailNormalized: string;
	firstName: string;
	lastName: string;
	fullName: string;
	role: "student";
	emailVerifiedAt: number;
	canAccessCases: boolean;
	createdAt: number;
	updatedAt: number;
};

export class DuplicatePendingRegistrationError extends Error {
	constructor() {
		super("A pending registration already exists for this email.");
		this.name = "DuplicatePendingRegistrationError";
	}
}

export class VerificationTokenAlreadyConsumedError extends Error {
	constructor() {
		super("The verification token was already consumed.");
		this.name = "VerificationTokenAlreadyConsumedError";
	}
}

export interface RegistrationWorkflowRepository {
	getPendingByEmail(
		emailNormalized: string
	): Promise<PendingRegistrationRecord | null>;
	createPendingRegistration(record: PendingRegistrationRecord): Promise<void>;
	replaceVerificationToken(
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
	): Promise<void>;
	findPendingByTokenHash(
		verificationTokenHash: string
	): Promise<PendingRegistrationRecord | null>;
	consumeVerificationToken(args: {
		emailNormalized: string;
		verificationTokenHash: string;
		consumedAt: number;
	}): Promise<void>;
	upsertStudentProfile(profile: StudentProfileRecord): Promise<void>;
	listExpiredPendingRegistrations(args: {
		now: number;
		limit: number;
	}): Promise<PendingRegistrationRecord[]>;
	deletePendingRegistration(emailNormalized: string): Promise<void>;
	recordCleanupFailure(args: {
		emailNormalized: string;
		attemptedAt: number;
		error: string;
	}): Promise<void>;
}
