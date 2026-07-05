import { StudentAlreadyExistsError } from "./identity";
import type { RegistrationIdentityProvider } from "./identity";
import type { RegistrationEmailSender } from "./email";
import type {
	PendingRegistrationRecord,
	RegistrationWorkflowRepository,
	StudentProfileRecord,
} from "./repository";
import {
	DuplicatePendingRegistrationError,
	VerificationResendLimitExceededError,
	VerificationTokenAlreadyConsumedError,
} from "./repository";
import {
	parseRegistrationInput,
	type RegistrationFieldErrors,
	type RegistrationInput,
} from "./schema";
import { generateVerificationToken, hashVerificationToken } from "./tokens";

export type RegistrationServiceResult =
	| {
			status: "verification_sent";
			message: string;
	  }
	| {
			status: "resend_blocked";
			message: string;
	  }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: RegistrationFieldErrors;
	  }
	| {
			status: "account_exists";
			message: string;
	  };

export type VerificationServiceResult =
	| { status: "verified"; message: string }
	| { status: "invalid"; message: string }
	| { status: "expired"; message: string }
	| { status: "already_used"; message: string };

export type RegistrationServiceConfig = {
	appBaseUrl: string;
	verificationTtlSeconds?: number;
	maxSendsPerWindow?: number;
	now?: () => number;
	generateToken?: () => string;
};

export type RegistrationServiceDependencies = {
	repository: RegistrationWorkflowRepository;
	identity: RegistrationIdentityProvider;
	email: RegistrationEmailSender;
	config: RegistrationServiceConfig;
};

const DEFAULT_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_MAX_SENDS_PER_WINDOW = 3;

export class RegistrationService {
	private readonly repository: RegistrationWorkflowRepository;
	private readonly identity: RegistrationIdentityProvider;
	private readonly email: RegistrationEmailSender;
	private readonly config: Required<
		Omit<RegistrationServiceConfig, "generateToken">
	> &
		Pick<RegistrationServiceConfig, "generateToken">;

	constructor(dependencies: RegistrationServiceDependencies) {
		this.repository = dependencies.repository;
		this.identity = dependencies.identity;
		this.email = dependencies.email;
		this.config = {
			appBaseUrl: dependencies.config.appBaseUrl,
			verificationTtlSeconds:
				dependencies.config.verificationTtlSeconds ??
				DEFAULT_VERIFICATION_TTL_SECONDS,
			maxSendsPerWindow:
				dependencies.config.maxSendsPerWindow ?? DEFAULT_MAX_SENDS_PER_WINDOW,
			now: dependencies.config.now ?? (() => Math.floor(Date.now() / 1000)),
			generateToken: dependencies.config.generateToken,
		};
	}

	async registerStudent(
		input: RegistrationInput,
	): Promise<RegistrationServiceResult> {
		const parsed = parseRegistrationInput(input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		const now = this.config.now();
		const existing = await this.repository.getPendingByEmail(
			parsed.data.emailNormalized,
		);

		if (existing && !existing.consumedAt && existing.expiresAt > now) {
			return this.handlePendingResend(existing);
		}

		if (existing && !existing.consumedAt && existing.expiresAt <= now) {
			await this.identity.deletePendingStudent(parsed.data.emailNormalized);
			await this.repository.deletePendingRegistration(
				parsed.data.emailNormalized,
			);
		}

		const expiresAt = now + this.config.verificationTtlSeconds;
		const ttl = expiresAt + 7 * 24 * 60 * 60;

		try {
			const pendingStudent = await this.identity.createPendingStudent({
				emailNormalized: parsed.data.emailNormalized,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				password: parsed.data.password,
			});
			const token = this.createToken();
			const tokenHash = hashVerificationToken(token);

			await this.repository.createPendingRegistration({
				emailNormalized: parsed.data.emailNormalized,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				cognitoSub: pendingStudent.cognitoSub,
				verificationTokenHash: tokenHash,
				verificationTokenHashes: [tokenHash],
				expiresAt,
				sendCount: 1,
				lastSentAt: now,
				rateLimitWindowStartedAt: now,
				createdAt: now,
				updatedAt: now,
				ttl,
				status: "pending",
			});

			await this.sendVerificationEmail({
				emailNormalized: parsed.data.emailNormalized,
				firstName: parsed.data.firstName,
				token,
				expiresAt,
				now,
			});
		} catch (error) {
			if (
				error instanceof StudentAlreadyExistsError ||
				error instanceof DuplicatePendingRegistrationError
			) {
				const pending = await this.repository.getPendingByEmail(
					parsed.data.emailNormalized,
				);

				if (pending && !pending.consumedAt && pending.expiresAt > now) {
					return this.handlePendingResend(pending);
				}

				return {
					status: "account_exists",
					message: "An account already exists for this email. Please sign in.",
				};
			}

			throw error;
		}

		return {
			status: "verification_sent",
			message:
				"We just sent a verification link to your inbox. Click the link in that email to confirm your account.",
		};
	}

	async verifyEmail(token: string | null): Promise<VerificationServiceResult> {
		if (!token) {
			return {
				status: "invalid",
				message: "This verification link is invalid.",
			};
		}

		const now = this.config.now();
		const tokenHash = hashVerificationToken(token);
		const registration =
			await this.repository.findPendingByTokenHash(tokenHash);

		if (!registration) {
			return {
				status: "invalid",
				message: "This verification link is invalid.",
			};
		}

		if (registration.consumedAt || registration.status === "verified") {
			return {
				status: "already_used",
				message: "This verification link has already been used.",
			};
		}

		if (registration.expiresAt <= now) {
			return {
				status: "expired",
				message: "This verification link has expired.",
			};
		}

		await this.identity.confirmStudentEmail({
			emailNormalized: registration.emailNormalized,
			firstName: registration.firstName,
			lastName: registration.lastName,
		});
		await this.repository.upsertStudentProfile(
			this.toStudentProfile(registration, now),
		);

		try {
			await this.repository.consumeVerificationToken({
				emailNormalized: registration.emailNormalized,
				verificationTokenHash: tokenHash,
				consumedAt: now,
			});
		} catch (error) {
			if (error instanceof VerificationTokenAlreadyConsumedError) {
				return {
					status: "already_used",
					message: "This verification link has already been used.",
				};
			}

			throw error;
		}

		return {
			status: "verified",
			message: "Your email has been successfully verified.",
		};
	}

	async cleanupExpiredPendingRegistrations(limit = 50) {
		const now = this.config.now();
		const expired = await this.repository.listExpiredPendingRegistrations({
			now,
			limit,
		});

		for (const registration of expired) {
			try {
				await this.identity.deletePendingStudent(registration.emailNormalized);
				await this.repository.deletePendingRegistration(
					registration.emailNormalized,
				);
			} catch (error) {
				await this.repository.recordCleanupFailure({
					emailNormalized: registration.emailNormalized,
					attemptedAt: now,
					error:
						error instanceof Error ? error.message : "Unknown cleanup failure",
				});
			}
		}

		return { deleted: expired.length };
	}

	private async handlePendingResend(
		registration: PendingRegistrationRecord,
	): Promise<RegistrationServiceResult> {
		const now = this.config.now();
		const sendCount = registration.sendCount;

		if (sendCount >= this.config.maxSendsPerWindow) {
			return this.resendBlocked();
		}

		const token = this.createToken();

		try {
			await this.repository.addVerificationToken(registration.emailNormalized, {
				previousVerificationTokenHash: registration.verificationTokenHash,
				verificationTokenHash: hashVerificationToken(token),
				lastSentAt: now,
				updatedAt: now,
				maxSendsPerWindow: this.config.maxSendsPerWindow,
			});
		} catch (error) {
			if (error instanceof VerificationResendLimitExceededError) {
				return this.resendBlocked();
			}

			throw error;
		}

		await this.sendVerificationEmail({
			emailNormalized: registration.emailNormalized,
			firstName: registration.firstName,
			token,
			expiresAt: registration.expiresAt,
			now,
		});

		return {
			status: "verification_sent",
			message: "Verification email sent. Please check your inbox.",
		};
	}

	private resendBlocked(): RegistrationServiceResult {
		return {
			status: "resend_blocked",
			message:
				"Maximum requests reached. Try again after the verification link expires.",
		};
	}

	private async sendVerificationEmail(input: {
		emailNormalized: string;
		firstName: string;
		token: string;
		expiresAt: number;
		now: number;
	}) {
		await this.email.sendRegistrationVerificationEmail({
			to: input.emailNormalized,
			firstName: input.firstName,
			verificationUrl: this.verificationUrl(input.token),
			expiresInHours: this.hoursUntil(input.expiresAt, input.now),
		});
	}

	private hoursUntil(expiresAt: number, now: number) {
		return Math.max(1, Math.ceil((expiresAt - now) / 60 / 60));
	}

	private verificationUrl(token: string) {
		const url = new URL("/verify-email", this.config.appBaseUrl);
		url.searchParams.set("token", token);
		return url.toString();
	}

	private createToken() {
		const generator = this.config.generateToken;

		if (generator) {
			return generator();
		}

		return generateVerificationToken();
	}

	private toStudentProfile(
		registration: PendingRegistrationRecord,
		now: number,
	): StudentProfileRecord {
		return {
			profileId: registration.cognitoSub,
			emailNormalized: registration.emailNormalized,
			firstName: registration.firstName,
			lastName: registration.lastName,
			fullName: `${registration.firstName} ${registration.lastName}`,
			role: "student",
			emailVerifiedAt: now,
			canAccessCases: true,
			createdAt: now,
			updatedAt: now,
		};
	}
}
