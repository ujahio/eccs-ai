import { describe, expect, it } from "vitest";
import type { RegistrationEmailSender } from "./email";
import type {
	CreatePendingStudentInput,
	RegistrationIdentityProvider
} from "./identity";
import { StudentAlreadyExistsError } from "./identity";
import type {
	PendingRegistrationRecord,
	RegistrationWorkflowRepository,
	StudentProfileRecord
} from "./repository";
import { VerificationTokenAlreadyConsumedError } from "./repository";
import { RegistrationService } from "./service";
import { hashVerificationToken } from "./tokens";

class InMemoryRegistrationRepository
	implements RegistrationWorkflowRepository
{
	registrations = new Map<string, PendingRegistrationRecord>();
	profiles = new Map<string, StudentProfileRecord>();
	deleteErrors = new Set<string>();
	stalePendingReads = new Set<string>();

	async getPendingByEmail(emailNormalized: string) {
		if (this.stalePendingReads.has(emailNormalized)) {
			this.stalePendingReads.delete(emailNormalized);
			return null;
		}

		return this.registrations.get(emailNormalized) ?? null;
	}

	async createPendingRegistration(record: PendingRegistrationRecord) {
		this.registrations.set(record.emailNormalized, record);
	}

	async addVerificationToken(
		emailNormalized: string,
		update: {
			previousVerificationTokenHash: string;
			verificationTokenHash: string;
			sendCount: number;
			lastSentAt: number;
			updatedAt: number;
		}
	) {
		const existing = this.registrations.get(emailNormalized);

		if (!existing) {
			throw new Error("Missing registration");
		}

		this.registrations.set(emailNormalized, {
			...existing,
			verificationTokenHash: update.verificationTokenHash,
			verificationTokenHashes: [
				...(existing.verificationTokenHashes ?? [
					update.previousVerificationTokenHash,
				]),
				update.verificationTokenHash,
			],
			sendCount: update.sendCount,
			lastSentAt: update.lastSentAt,
			updatedAt: update.updatedAt,
		});
	}

	async findPendingByTokenHash(verificationTokenHash: string) {
		return (
			Array.from(this.registrations.values()).find(
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
		const existing = this.registrations.get(args.emailNormalized);

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

		this.registrations.set(args.emailNormalized, {
			...existing,
			consumedAt: args.consumedAt,
			status: "verified",
			updatedAt: args.consumedAt
		});
	}

	async upsertStudentProfile(profile: StudentProfileRecord) {
		this.profiles.set(profile.emailNormalized, profile);
	}

	async listExpiredPendingRegistrations(args: { now: number; limit: number }) {
		return Array.from(this.registrations.values())
			.filter(
				(record) =>
					record.status === "pending" &&
					!record.consumedAt &&
					record.expiresAt <= args.now
			)
			.slice(0, args.limit);
	}

	async deletePendingRegistration(emailNormalized: string) {
		if (this.deleteErrors.has(emailNormalized)) {
			throw new Error(`Failed to delete ${emailNormalized}`);
		}
		this.registrations.delete(emailNormalized);
	}

	cleanupFailures: Array<{
		emailNormalized: string;
		attemptedAt: number;
		error: string;
	}> = [];

	async recordCleanupFailure(args: {
		emailNormalized: string;
		attemptedAt: number;
		error: string;
	}) {
		this.cleanupFailures.push(args);
	}
}

class FakeIdentityProvider implements RegistrationIdentityProvider {
	created: CreatePendingStudentInput[] = [];
	confirmed: string[] = [];
	deleted: string[] = [];
	deleteErrors = new Set<string>();
	confirmErrors = new Set<string>();

	async createPendingStudent(input: CreatePendingStudentInput) {
		if (
			this.created.some(
				(created) => created.emailNormalized === input.emailNormalized
			)
		) {
			throw new StudentAlreadyExistsError();
		}

		this.created.push(input);
		return { cognitoSub: `sub-${input.emailNormalized}` };
	}

	async confirmStudentEmail(args: { emailNormalized: string }) {
		if (this.confirmErrors.has(args.emailNormalized)) {
			throw new Error(`Failed to confirm ${args.emailNormalized}`);
		}

		this.confirmed.push(args.emailNormalized);
	}

	async deletePendingStudent(emailNormalized: string) {
		if (this.deleteErrors.has(emailNormalized)) {
			throw new Error(`Failed to delete ${emailNormalized}`);
		}
		this.deleted.push(emailNormalized);
	}
}

class FakeEmailSender implements RegistrationEmailSender {
	sent: Array<{
		to: string;
		firstName: string;
		verificationUrl: string;
		expiresInHours: number;
	}> = [];

	async sendRegistrationVerificationEmail(email: {
		to: string;
		firstName: string;
		verificationUrl: string;
		expiresInHours: number;
	}) {
		this.sent.push(email);
	}
}

function createHarness(options: {
	now?: number;
	tokens?: string[];
	maxSendsPerWindow?: number;
} = {}) {
	const repository = new InMemoryRegistrationRepository();
	const identity = new FakeIdentityProvider();
	const email = new FakeEmailSender();
	let now = options.now ?? 1_000;
	const tokens = [...(options.tokens ?? ["token-1", "token-2"])];
	const service = new RegistrationService({
		repository,
		identity,
		email,
		config: {
			appBaseUrl: "https://eccs.example",
			now: () => now,
			generateToken: () => tokens.shift() ?? "fallback-token",
			maxSendsPerWindow: options.maxSendsPerWindow
		}
	});

	return {
		repository,
		identity,
		email,
		service,
		setNow(value: number) {
			now = value;
		}
	};
}

const validInput = {
	firstName: "Jordan",
	lastName: "Adebayo",
	email: "Jordan@Example.COM",
	password: "casework1"
};

describe("RegistrationService", () => {
	it("creates a pending registration and sends a 24-hour verification email", async () => {
		const { email, identity, repository, service } = createHarness({
			tokens: ["verify-me"]
		});

		const result = await service.registerStudent(validInput);

		expect(result).toMatchObject({
			status: "verification_sent",
			message: "Check your email. Verification expires in 24 hours."
		});
		expect(identity.created).toHaveLength(1);
		expect(identity.created[0]).toMatchObject({
			emailNormalized: "jordan@example.com",
			firstName: "Jordan",
			lastName: "Adebayo"
		});
		expect(email.sent).toHaveLength(1);
		expect(email.sent[0].verificationUrl).toContain("/verify-email?token=");
		expect(
			repository.registrations.get("jordan@example.com")
		).toMatchObject({
			firstName: "Jordan",
			lastName: "Adebayo",
			sendCount: 1,
			expiresAt: 87_400,
			verificationTokenHash: hashVerificationToken("verify-me"),
			verificationTokenHashes: [hashVerificationToken("verify-me")]
		});
	});

	it("treats duplicate active registrations as resends without mutating name or password", async () => {
		const { email, identity, repository, service, setNow } = createHarness({
			tokens: ["first-token", "second-token"]
		});

		await service.registerStudent(validInput);
		setNow(2_000);
		const result = await service.registerStudent({
			firstName: "Changed",
			lastName: "Name",
			email: "jordan@example.com",
			password: "different1"
		});

		expect(result.status).toBe("verification_sent");
		expect(identity.created).toHaveLength(1);
		expect(email.sent).toHaveLength(2);
		expect(
			repository.registrations.get("jordan@example.com")
		).toMatchObject({
			firstName: "Jordan",
			lastName: "Adebayo",
			sendCount: 2,
			expiresAt: 87_400,
			ttl: 692_200,
			verificationTokenHash: hashVerificationToken("second-token"),
			verificationTokenHashes: [
				hashVerificationToken("first-token"),
				hashVerificationToken("second-token")
			]
		});
		expect(email.sent[1]).toMatchObject({
			firstName: "Jordan",
			expiresInHours: 24
		});
	});

	it("resends when Cognito already has the active pending student", async () => {
		const { email, identity, repository, service, setNow } = createHarness({
			tokens: ["first-token", "second-token"]
		});

		await service.registerStudent(validInput);
		repository.stalePendingReads.add("jordan@example.com");
		setNow(2_000);

		const result = await service.registerStudent(validInput);

		expect(result.status).toBe("verification_sent");
		expect(identity.created).toHaveLength(1);
		expect(email.sent).toHaveLength(2);
		expect(
			repository.registrations.get("jordan@example.com")
		).toMatchObject({
			sendCount: 2,
			expiresAt: 87_400,
			verificationTokenHash: hashVerificationToken("second-token"),
			verificationTokenHashes: [
				hashVerificationToken("first-token"),
				hashVerificationToken("second-token")
			]
		});
	});

	it("keeps earlier verification links valid after a resend", async () => {
		const { identity, repository, service, setNow } = createHarness({
			tokens: ["first-token", "second-token"]
		});

		await service.registerStudent(validInput);
		setNow(2_000);
		await service.registerStudent(validInput);

		const result = await service.verifyEmail("first-token");

		expect(result.status).toBe("verified");
		expect(identity.confirmed).toEqual(["jordan@example.com"]);
		expect(
			repository.registrations.get("jordan@example.com")
		).toMatchObject({
			consumedAt: 2_000,
			status: "verified"
		});
	});

	it("rate-limits repeated verification resends", async () => {
		const { email, service } = createHarness({
			maxSendsPerWindow: 1,
			tokens: ["first-token", "second-token"]
		});

		await service.registerStudent(validInput);
		const result = await service.registerStudent(validInput);

		expect(result).toMatchObject({
			status: "resend_blocked",
			message:
				"Maximum requests reached. Try again after the verification link expires."
		});
		expect(email.sent).toHaveLength(1);
	});

	it("keeps resend blocking active until the original verification expires", async () => {
		const { email, repository, service, setNow } = createHarness({
			maxSendsPerWindow: 1,
			tokens: ["first-token", "second-token"]
		});

		await service.registerStudent(validInput);
		setNow(5_000);
		const result = await service.registerStudent(validInput);

		expect(result).toMatchObject({
			status: "resend_blocked",
			message:
				"Maximum requests reached. Try again after the verification link expires."
		});
		expect(email.sent).toHaveLength(1);
		expect(
			repository.registrations.get("jordan@example.com")
		).toMatchObject({
			sendCount: 1,
			expiresAt: 87_400,
			ttl: 692_200
		});
	});

	it("rejects expired verification tokens", async () => {
		const { identity, repository, service } = createHarness({ now: 2_000 });
		repository.registrations.set("jordan@example.com", {
			emailNormalized: "jordan@example.com",
			firstName: "Jordan",
			lastName: "Adebayo",
			cognitoSub: "sub-jordan@example.com",
			verificationTokenHash: hashVerificationToken("expired-token"),
			expiresAt: 1_999,
			sendCount: 1,
			lastSentAt: 1_000,
			rateLimitWindowStartedAt: 1_000,
			createdAt: 1_000,
			updatedAt: 1_000,
			ttl: 1_999,
			status: "pending"
		});

		const result = await service.verifyEmail("expired-token");

		expect(result.status).toBe("expired");
		expect(identity.confirmed).toEqual([]);
		expect(repository.profiles.size).toBe(0);
	});

	it("consumes a valid token once and creates the student profile", async () => {
		const { identity, repository, service } = createHarness({ now: 2_000 });
		repository.registrations.set("jordan@example.com", {
			emailNormalized: "jordan@example.com",
			firstName: "Jordan",
			lastName: "Adebayo",
			cognitoSub: "sub-jordan@example.com",
			verificationTokenHash: hashVerificationToken("valid-token"),
			expiresAt: 3_000,
			sendCount: 1,
			lastSentAt: 1_000,
			rateLimitWindowStartedAt: 1_000,
			createdAt: 1_000,
			updatedAt: 1_000,
			ttl: 3_000,
			status: "pending"
		});

		const result = await service.verifyEmail("valid-token");
		const secondResult = await service.verifyEmail("valid-token");

		expect(result.status).toBe("verified");
		expect(secondResult.status).toBe("already_used");
		expect(identity.confirmed).toEqual(["jordan@example.com"]);
		expect(
			repository.registrations.get("jordan@example.com")
		).toMatchObject({
			consumedAt: 2_000,
			status: "verified"
		});
		expect(repository.profiles.get("jordan@example.com")).toMatchObject({
			emailNormalized: "jordan@example.com",
			fullName: "Jordan Adebayo",
			role: "student",
			canAccessCases: true
		});
	});

	it("does not consume the verification token when Cognito confirmation fails", async () => {
		const { identity, repository, service } = createHarness({ now: 2_000 });
		identity.confirmErrors.add("jordan@example.com");
		repository.registrations.set("jordan@example.com", {
			emailNormalized: "jordan@example.com",
			firstName: "Jordan",
			lastName: "Adebayo",
			cognitoSub: "sub-jordan@example.com",
			verificationTokenHash: hashVerificationToken("valid-token"),
			expiresAt: 3_000,
			sendCount: 1,
			lastSentAt: 1_000,
			rateLimitWindowStartedAt: 1_000,
			createdAt: 1_000,
			updatedAt: 1_000,
			ttl: 3_000,
			status: "pending"
		});

		await expect(service.verifyEmail("valid-token")).rejects.toThrow(
			"Failed to confirm jordan@example.com"
		);
		const registration = repository.registrations.get("jordan@example.com");

		expect(registration?.consumedAt).toBeUndefined();
		expect(registration?.status).toBe("pending");
		expect(repository.profiles.size).toBe(0);
	});

	it("cleans up expired pending registrations and returns the count", async () => {
		const { identity, repository, service } = createHarness({
			now: 5_000
		});

		repository.registrations.set("a@example.com", {
			emailNormalized: "a@example.com",
			firstName: "A",
			lastName: "User",
			cognitoSub: "sub-a",
			verificationTokenHash: "hash-a",
			expiresAt: 4_000,
			sendCount: 1,
			lastSentAt: 3_000,
			rateLimitWindowStartedAt: 3_000,
			createdAt: 3_000,
			updatedAt: 3_000,
			ttl: 4_000,
			status: "pending"
		});
		repository.registrations.set("b@example.com", {
			emailNormalized: "b@example.com",
			firstName: "B",
			lastName: "User",
			cognitoSub: "sub-b",
			verificationTokenHash: "hash-b",
			expiresAt: 6_000,
			sendCount: 1,
			lastSentAt: 3_000,
			rateLimitWindowStartedAt: 3_000,
			createdAt: 3_000,
			updatedAt: 3_000,
			ttl: 6_000,
			status: "pending"
		});

		const result = await service.cleanupExpiredPendingRegistrations();

		expect(result).toEqual({ deleted: 1 });
		expect(identity.deleted).toEqual(["a@example.com"]);
		expect(repository.registrations.has("a@example.com")).toBe(false);
		expect(repository.registrations.has("b@example.com")).toBe(true);
	});

	it("respects the limit parameter", async () => {
		const { repository, service } = createHarness({ now: 5_000 });

		const makeRecord = (email: string, expiresAt: number): PendingRegistrationRecord => ({
			emailNormalized: email,
			firstName: "Test",
			lastName: "User",
			cognitoSub: `sub-${email}`,
			verificationTokenHash: `hash-${email}`,
			expiresAt,
			sendCount: 1,
			lastSentAt: 3_000,
			rateLimitWindowStartedAt: 3_000,
			createdAt: 3_000,
			updatedAt: 3_000,
			ttl: expiresAt,
			status: "pending"
		});

		repository.registrations.set("a@example.com", makeRecord("a@example.com", 2_000));
		repository.registrations.set("b@example.com", makeRecord("b@example.com", 3_000));
		repository.registrations.set("c@example.com", makeRecord("c@example.com", 4_000));

		const result = await service.cleanupExpiredPendingRegistrations(2);

		expect(result).toEqual({ deleted: 2 });
		expect(repository.registrations.size).toBe(1);
		expect(repository.registrations.has("c@example.com")).toBe(true);
	});

	it("records cleanup failure when identity delete throws", async () => {
		const { identity, repository, service } = createHarness({ now: 5_000 });
		identity.deleteErrors.add("fail@example.com");

		repository.registrations.set("fail@example.com", {
			emailNormalized: "fail@example.com",
			firstName: "Fail",
			lastName: "User",
			cognitoSub: "sub-fail",
			verificationTokenHash: "hash-fail",
			expiresAt: 4_000,
			sendCount: 1,
			lastSentAt: 3_000,
			rateLimitWindowStartedAt: 3_000,
			createdAt: 3_000,
			updatedAt: 3_000,
			ttl: 4_000,
			status: "pending"
		});

		const result = await service.cleanupExpiredPendingRegistrations();

		expect(result).toEqual({ deleted: 1 });
		expect(repository.cleanupFailures).toHaveLength(1);
		expect(repository.cleanupFailures[0]).toMatchObject({
			emailNormalized: "fail@example.com",
			error: "Failed to delete fail@example.com"
		});
		expect(repository.registrations.has("fail@example.com")).toBe(true);
	});

	it("records cleanup failure when repository delete throws", async () => {
		const { repository, service } = createHarness({ now: 5_000 });
		repository.deleteErrors.add("repo-fail@example.com");

		repository.registrations.set("repo-fail@example.com", {
			emailNormalized: "repo-fail@example.com",
			firstName: "Repo",
			lastName: "Fail",
			cognitoSub: "sub-repo-fail",
			verificationTokenHash: "hash-repo-fail",
			expiresAt: 4_000,
			sendCount: 1,
			lastSentAt: 3_000,
			rateLimitWindowStartedAt: 3_000,
			createdAt: 3_000,
			updatedAt: 3_000,
			ttl: 4_000,
			status: "pending"
		});

		const result = await service.cleanupExpiredPendingRegistrations();

		expect(result).toEqual({ deleted: 1 });
		expect(repository.cleanupFailures).toHaveLength(1);
		expect(repository.cleanupFailures[0]).toMatchObject({
			emailNormalized: "repo-fail@example.com",
			error: "Failed to delete repo-fail@example.com"
		});
	});

	it("returns zero when no expired registrations exist", async () => {
		const { service } = createHarness({ now: 5_000 });

		const result = await service.cleanupExpiredPendingRegistrations();

		expect(result).toEqual({ deleted: 0 });
	});
});
