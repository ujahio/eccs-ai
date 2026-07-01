import { describe, expect, it } from "vitest";
import type { RegistrationEmailSender } from "./email";
import type {
	CreatePendingStudentInput,
	RegistrationIdentityProvider
} from "./identity";
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

	async getPendingByEmail(emailNormalized: string) {
		return this.registrations.get(emailNormalized) ?? null;
	}

	async createPendingRegistration(record: PendingRegistrationRecord) {
		this.registrations.set(record.emailNormalized, record);
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
		const existing = this.registrations.get(emailNormalized);

		if (!existing) {
			throw new Error("Missing registration");
		}

		this.registrations.set(emailNormalized, {
			...existing,
			...update
		});
	}

	async findPendingByTokenHash(verificationTokenHash: string) {
		return (
			Array.from(this.registrations.values()).find(
				(record) => record.verificationTokenHash === verificationTokenHash
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
			existing.verificationTokenHash !== args.verificationTokenHash
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
		this.registrations.delete(emailNormalized);
	}

	async recordCleanupFailure() {}
}

class FakeIdentityProvider implements RegistrationIdentityProvider {
	created: CreatePendingStudentInput[] = [];
	confirmed: string[] = [];
	deleted: string[] = [];

	async createPendingStudent(input: CreatePendingStudentInput) {
		this.created.push(input);
		return { cognitoSub: `sub-${input.emailNormalized}` };
	}

	async confirmStudentEmail(args: { emailNormalized: string }) {
		this.confirmed.push(args.emailNormalized);
	}

	async deletePendingStudent(emailNormalized: string) {
		this.deleted.push(emailNormalized);
	}
}

class FakeEmailSender implements RegistrationEmailSender {
	sent: Array<{ to: string; verificationUrl: string }> = [];

	async sendRegistrationVerificationEmail(email: {
		to: string;
		verificationUrl: string;
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
			verificationTokenHash: hashVerificationToken("verify-me")
		});
	});

	it("treats duplicate active registrations as resends without mutating name or password", async () => {
		const { email, identity, repository, service } = createHarness({
			tokens: ["first-token", "second-token"]
		});

		await service.registerStudent(validInput);
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
			verificationTokenHash: hashVerificationToken("second-token")
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
			status: "resend_rate_limited",
			message:
				"A verification email was sent recently. Please check your inbox before requesting another."
		});
		expect(email.sent).toHaveLength(1);
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
});
