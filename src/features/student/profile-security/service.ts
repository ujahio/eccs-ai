import { InvalidLoginCredentialsError } from "@/features/auth/login/service";
import {
	generateVerificationToken,
	hashVerificationToken,
} from "@/features/auth/registration/tokens";
import type { StudentProfileRecord } from "@/features/auth/registration/repository";
import {
	parseStudentEmailChangeInput,
	parseStudentNameInput,
	parseStudentPasswordChangeInput,
	type StudentEmailChangeFieldErrors,
	type StudentEmailChangeInput,
	type StudentNameFieldErrors,
	type StudentNameInput,
	type StudentPasswordChangeFieldErrors,
	type StudentPasswordChangeInput,
} from "./schema";

export class StudentEmailUnavailableError extends Error {
	constructor() {
		super("This email address is already in use.");
		this.name = "StudentEmailUnavailableError";
	}
}

export type StudentProfileServiceConfig = {
	appBaseUrl: string;
	emailChangeTtlSeconds?: number;
	nowSeconds?: () => number;
	nowMilliseconds?: () => number;
	generateToken?: () => string;
};

export interface StudentProfileIdentityProvider {
	updateStudentName(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}): Promise<void>;
	authenticateStudent(args: {
		emailNormalized: string;
		password: string;
	}): Promise<unknown>;
	updateStudentEmail(args: {
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}): Promise<void>;
	setStudentPassword(args: {
		emailNormalized: string;
		password: string;
	}): Promise<void>;
	invalidateCognitoSessions(args: { emailNormalized: string }): Promise<void>;
}

export interface StudentProfileRepository {
	getStudentProfileByEmail(
		emailNormalized: string,
	): Promise<StudentProfileRecord | null>;
	updateStudentName(args: {
		profileId: string;
		firstName: string;
		lastName: string;
		fullName: string;
		updatedAt: number;
	}): Promise<void>;
	storePendingEmailChange(args: {
		profileId: string;
		pendingEmail: string;
		pendingEmailVerificationTokenHash: string;
		pendingEmailVerificationExpiresAt: number;
		pendingEmailVerificationRequestedAt: number;
		updatedAt: number;
	}): Promise<void>;
	findStudentProfileByPendingEmailTokenHash(
		tokenHash: string,
	): Promise<StudentProfileRecord | null>;
	completePendingEmailChange(args: {
		profileId: string;
		currentEmailNormalized: string;
		newEmailNormalized: string;
		verifiedAt: number;
		sessionsInvalidatedAt: number;
		sessionInvalidationExemptToken?: string;
	}): Promise<void>;
	invalidateOtherSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
		updatedAt: number;
		sessionInvalidationExemptToken?: string;
	}): Promise<void>;
}

export interface StudentProfileEmailSender {
	sendEmailChangeVerificationEmail(email: {
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}): Promise<void>;
	sendPasswordChangedEmail(email: { to: string }): Promise<void>;
}

export type StudentNameServiceResult =
	| { status: "name_updated"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: StudentNameFieldErrors;
	  };

export type StudentEmailChangeRequestServiceResult =
	| { status: "verification_sent"; message: string; pendingEmail: string }
	| { status: "same_email"; message: string }
	| { status: "email_unavailable"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: StudentEmailChangeFieldErrors;
	  };

export type StudentEmailChangeVerificationServiceResult =
	| { status: "verified_sign_in_required"; message: string }
	| { status: "invalid"; message: string }
	| { status: "expired"; message: string }
	| { status: "already_used"; message: string };

export type StudentPasswordChangeServiceResult =
	| { status: "password_changed"; message: string }
	| { status: "invalid_current_password"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: StudentPasswordChangeFieldErrors;
	  };

const DEFAULT_EMAIL_CHANGE_TTL_SECONDS = 24 * 60 * 60;

export class StudentProfileService {
	private readonly config: Required<
		Omit<StudentProfileServiceConfig, "generateToken">
	> &
		Pick<StudentProfileServiceConfig, "generateToken">;

	constructor(
		private readonly identity: StudentProfileIdentityProvider,
		private readonly profiles: StudentProfileRepository,
		private readonly email: StudentProfileEmailSender,
		config: StudentProfileServiceConfig,
	) {
		this.config = {
			appBaseUrl: config.appBaseUrl,
			emailChangeTtlSeconds:
				config.emailChangeTtlSeconds ?? DEFAULT_EMAIL_CHANGE_TTL_SECONDS,
			nowSeconds: config.nowSeconds ?? (() => Math.floor(Date.now() / 1000)),
			nowMilliseconds: config.nowMilliseconds ?? (() => Date.now()),
			generateToken: config.generateToken,
		};
	}

	async updateName(
		profile: StudentProfileRecord,
		input: StudentNameInput,
	): Promise<StudentNameServiceResult> {
		const parsed = parseStudentNameInput(input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		const now = this.config.nowSeconds();

		await this.identity.updateStudentName({
			emailNormalized: profile.emailNormalized,
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			fullName: parsed.data.fullName,
		});
		await this.profiles.updateStudentName({
			profileId: profile.profileId,
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			fullName: parsed.data.fullName,
			updatedAt: now,
		});

		return {
			status: "name_updated",
			message: "Your name has been updated.",
		};
	}

	async requestEmailChange(
		profile: StudentProfileRecord,
		input: StudentEmailChangeInput,
	): Promise<StudentEmailChangeRequestServiceResult> {
		const parsed = parseStudentEmailChangeInput(input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		if (parsed.data.emailNormalized === profile.emailNormalized) {
			return {
				status: "same_email",
				message: "Enter a different email address.",
			};
		}

		const existing = await this.profiles.getStudentProfileByEmail(
			parsed.data.emailNormalized,
		);

		if (existing && existing.profileId !== profile.profileId) {
			return {
				status: "email_unavailable",
				message: "This email address is already in use.",
			};
		}

		const now = this.config.nowSeconds();
		const expiresAt = now + this.config.emailChangeTtlSeconds;
		const token = this.createToken();
		const tokenHash = hashVerificationToken(token);

		await this.profiles.storePendingEmailChange({
			profileId: profile.profileId,
			pendingEmail: parsed.data.emailNormalized,
			pendingEmailVerificationTokenHash: tokenHash,
			pendingEmailVerificationExpiresAt: expiresAt,
			pendingEmailVerificationRequestedAt: now,
			updatedAt: now,
		});

		await this.email.sendEmailChangeVerificationEmail({
			to: parsed.data.emailNormalized,
			verificationUrl: this.emailChangeVerificationUrl(token),
			expiresInHours: this.hoursUntil(expiresAt, now),
		});

		return {
			status: "verification_sent",
			message: "We sent a verification link to your new email address.",
			pendingEmail: parsed.data.emailNormalized,
		};
	}

	async verifyEmailChange(args: {
		token: string | null;
	}): Promise<StudentEmailChangeVerificationServiceResult> {
		if (!args.token) {
			return {
				status: "invalid",
				message: "This email change link is invalid.",
			};
		}

		const now = this.config.nowSeconds();
		const tokenHash = hashVerificationToken(args.token);
		const profile =
			await this.profiles.findStudentProfileByPendingEmailTokenHash(tokenHash);

		if (!profile || !profile.pendingEmail) {
			return {
				status: "invalid",
				message: "This email change link is invalid.",
			};
		}

		if (
			profile.pendingEmailVerificationTokenHash &&
			profile.pendingEmailVerificationTokenHash !== tokenHash
		) {
			return {
				status: "already_used",
				message: "This email change link has already been used.",
			};
		}

		if (
			!profile.pendingEmailVerificationExpiresAt ||
			profile.pendingEmailVerificationExpiresAt <= now
		) {
			return {
				status: "expired",
				message: "This email change link has expired.",
			};
		}

		try {
			await this.identity.updateStudentEmail({
				currentEmailNormalized: profile.emailNormalized,
				newEmailNormalized: profile.pendingEmail,
			});
		} catch (error) {
			if (error instanceof StudentEmailUnavailableError) {
				return {
					status: "invalid",
					message: "This email address is already in use.",
				};
			}

			throw error;
		}

		const sessionsInvalidatedAt = this.config.nowMilliseconds();

		await this.identity.invalidateCognitoSessions({
			emailNormalized: profile.pendingEmail,
		});
		await this.profiles.completePendingEmailChange({
			profileId: profile.profileId,
			currentEmailNormalized: profile.emailNormalized,
			newEmailNormalized: profile.pendingEmail,
			verifiedAt: now,
			sessionsInvalidatedAt,
		});

		return {
			status: "verified_sign_in_required",
			message: "Your email address has been updated. Please sign in again.",
		};
	}

	async changePassword(args: {
		profile: StudentProfileRecord;
		input: StudentPasswordChangeInput;
		currentSessionToken: string | null;
	}): Promise<StudentPasswordChangeServiceResult> {
		const parsed = parseStudentPasswordChangeInput(args.input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		try {
			await this.identity.authenticateStudent({
				emailNormalized: args.profile.emailNormalized,
				password: parsed.data.currentPassword,
			});
		} catch (error) {
			if (error instanceof InvalidLoginCredentialsError) {
				return {
					status: "invalid_current_password",
					message: "Enter your current password.",
				};
			}

			throw error;
		}

		const invalidatedAt = this.config.nowMilliseconds();
		const updatedAt = this.config.nowSeconds();

		await this.identity.setStudentPassword({
			emailNormalized: args.profile.emailNormalized,
			password: parsed.data.password,
		});
		await this.identity.invalidateCognitoSessions({
			emailNormalized: args.profile.emailNormalized,
		});
		await this.profiles.invalidateOtherSessionsForUser({
			userId: args.profile.profileId,
			invalidatedAt,
			updatedAt,
			sessionInvalidationExemptToken: args.currentSessionToken ?? undefined,
		});
		await this.email.sendPasswordChangedEmail({
			to: args.profile.emailNormalized,
		});

		return {
			status: "password_changed",
			message: "Your password was changed.",
		};
	}

	private emailChangeVerificationUrl(token: string) {
		const url = new URL("/verify-email-change", this.config.appBaseUrl);
		url.searchParams.set("token", token);
		return url.toString();
	}

	private hoursUntil(expiresAt: number, now: number) {
		return Math.max(1, Math.ceil((expiresAt - now) / 60 / 60));
	}

	private createToken() {
		const generator = this.config.generateToken;
		return generator ? generator() : generateVerificationToken();
	}
}
