import { StudentAlreadyExistsError } from "./identity";
import type { RegistrationIdentityProvider } from "./identity";
import type { RegistrationEmailSender } from "./email";
import type {
	PendingRegistrationRecord,
	RegistrationWorkflowRepository,
	StudentProfileRecord
} from "./repository";
import {
	DuplicatePendingRegistrationError,
	VerificationTokenAlreadyConsumedError
} from "./repository";
import {
	parseRegistrationInput,
	type RegistrationFieldErrors,
	type RegistrationInput
} from "./schema";
import { generateVerificationToken, hashVerificationToken } from "./tokens";

export type RegistrationServiceResult =
	| {
			status: "verification_sent";
			message: string;
	  }
	| {
			status: "resend_rate_limited";
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
	resendWindowSeconds?: number;
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
const DEFAULT_RESEND_WINDOW_SECONDS = 60 * 60;
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
			resendWindowSeconds:
				dependencies.config.resendWindowSeconds ??
				DEFAULT_RESEND_WINDOW_SECONDS,
			maxSendsPerWindow:
				dependencies.config.maxSendsPerWindow ?? DEFAULT_MAX_SENDS_PER_WINDOW,
			now: dependencies.config.now ?? (() => Math.floor(Date.now() / 1000)),
			generateToken: dependencies.config.generateToken
		};
	}

	async registerStudent(
		input: RegistrationInput
	): Promise<RegistrationServiceResult> {
		const parsed = parseRegistrationInput(input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors
			};
		}

		const now = this.config.now();
		const existing = await this.repository.getPendingByEmail(
			parsed.data.emailNormalized
		);

		if (existing && !existing.consumedAt && existing.expiresAt > now) {
			return this.handlePendingResend(existing, parsed.data.firstName);
		}

		if (existing && !existing.consumedAt && existing.expiresAt <= now) {
			await this.identity.deletePendingStudent(parsed.data.emailNormalized);
			await this.repository.deletePendingRegistration(
				parsed.data.emailNormalized
			);
		}

		const token = this.createToken();
		const expiresAt = now + this.config.verificationTtlSeconds;
		const ttl = expiresAt + 7 * 24 * 60 * 60;

		try {
			const pendingStudent = await this.identity.createPendingStudent({
				emailNormalized: parsed.data.emailNormalized,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				password: parsed.data.password
			});

			await this.repository.createPendingRegistration({
				emailNormalized: parsed.data.emailNormalized,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				cognitoSub: pendingStudent.cognitoSub,
				verificationTokenHash: hashVerificationToken(token),
				expiresAt,
				sendCount: 1,
				lastSentAt: now,
				rateLimitWindowStartedAt: now,
				createdAt: now,
				updatedAt: now,
				ttl,
				status: "pending"
			});
		} catch (error) {
			if (
				error instanceof StudentAlreadyExistsError ||
				error instanceof DuplicatePendingRegistrationError
			) {
				return {
					status: "account_exists",
					message: "An account already exists for this email. Please sign in."
				};
			}

			throw error;
		}

		await this.sendVerificationEmail({
			emailNormalized: parsed.data.emailNormalized,
			firstName: parsed.data.firstName,
			token
		});

		return {
			status: "verification_sent",
			message: "Check your email. Verification expires in 24 hours."
		};
	}

	async verifyEmail(token: string | null): Promise<VerificationServiceResult> {
		if (!token) {
			return {
				status: "invalid",
				message: "This verification link is invalid."
			};
		}

		const now = this.config.now();
		const tokenHash = hashVerificationToken(token);
		const registration = await this.repository.findPendingByTokenHash(tokenHash);

		if (!registration) {
			return {
				status: "invalid",
				message: "This verification link is invalid."
			};
		}

		if (registration.consumedAt || registration.status === "verified") {
			return {
				status: "already_used",
				message: "This verification link has already been used."
			};
		}

		if (registration.expiresAt <= now) {
			return {
				status: "expired",
				message: "This verification link has expired."
			};
		}

		try {
			await this.repository.consumeVerificationToken({
				emailNormalized: registration.emailNormalized,
				verificationTokenHash: tokenHash,
				consumedAt: now
			});
		} catch (error) {
			if (error instanceof VerificationTokenAlreadyConsumedError) {
				return {
					status: "already_used",
					message: "This verification link has already been used."
				};
			}

			throw error;
		}

		await this.identity.confirmStudentEmail({
			emailNormalized: registration.emailNormalized,
			firstName: registration.firstName,
			lastName: registration.lastName
		});
		await this.repository.upsertStudentProfile(
			this.toStudentProfile(registration, now)
		);

		return {
			status: "verified",
			message: "Your email has been verified. Please sign in."
		};
	}

	async cleanupExpiredPendingRegistrations(limit = 50) {
		const now = this.config.now();
		const expired = await this.repository.listExpiredPendingRegistrations({
			now,
			limit
		});

		for (const registration of expired) {
			try {
				await this.identity.deletePendingStudent(registration.emailNormalized);
				await this.repository.deletePendingRegistration(
					registration.emailNormalized
				);
			} catch (error) {
				await this.repository.recordCleanupFailure({
					emailNormalized: registration.emailNormalized,
					attemptedAt: now,
					error:
						error instanceof Error
							? error.message
							: "Unknown cleanup failure"
				});
			}
		}

		return { deleted: expired.length };
	}

	private async handlePendingResend(
		registration: PendingRegistrationRecord,
		firstName: string
	): Promise<RegistrationServiceResult> {
		const now = this.config.now();
		const shouldResetWindow =
			now - registration.rateLimitWindowStartedAt >=
			this.config.resendWindowSeconds;
		const windowStartedAt = shouldResetWindow
			? now
			: registration.rateLimitWindowStartedAt;
		const sendCount = shouldResetWindow ? 0 : registration.sendCount;

		if (sendCount >= this.config.maxSendsPerWindow) {
			return {
				status: "resend_rate_limited",
				message:
					"A verification email was sent recently. Please check your inbox before requesting another."
			};
		}

		const token = this.createToken();
		const expiresAt = now + this.config.verificationTtlSeconds;

		await this.repository.replaceVerificationToken(
			registration.emailNormalized,
			{
				verificationTokenHash: hashVerificationToken(token),
				expiresAt,
				sendCount: sendCount + 1,
				lastSentAt: now,
				rateLimitWindowStartedAt: windowStartedAt,
				updatedAt: now,
				ttl: expiresAt + 7 * 24 * 60 * 60
			}
		);

		await this.sendVerificationEmail({
			emailNormalized: registration.emailNormalized,
			firstName,
			token
		});

		return {
			status: "verification_sent",
			message: "Verification email sent. Please check your inbox."
		};
	}

	private async sendVerificationEmail(input: {
		emailNormalized: string;
		firstName: string;
		token: string;
	}) {
		await this.email.sendRegistrationVerificationEmail({
			to: input.emailNormalized,
			firstName: input.firstName,
			verificationUrl: this.verificationUrl(input.token),
			expiresInHours: this.config.verificationTtlSeconds / 60 / 60
		});
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
		now: number
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
			updatedAt: now
		};
	}
}
