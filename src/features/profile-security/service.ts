import { InvalidLoginCredentialsError } from "@/features/auth/login/service";
import {
	generateVerificationToken,
	hashVerificationToken,
} from "@/features/auth/registration/tokens";
import type { AppProfileRecord } from "@/features/auth/registration/repository";
import {
	parseProfileSecurityEmailChangeInput,
	parseProfileSecurityNameInput,
	parseProfileSecurityPasswordChangeInput,
	type ProfileSecurityEmailChangeFieldErrors,
	type ProfileSecurityEmailChangeInput,
	type ProfileSecurityNameFieldErrors,
	type ProfileSecurityNameInput,
	type ProfileSecurityPasswordChangeFieldErrors,
	type ProfileSecurityPasswordChangeInput,
} from "./schema";

export const EMAIL_ADDRESS_UNAVAILABLE_MESSAGE =
	"We couldn't use that email address. Try another email or contact support.";

export class ProfileSecurityEmailUnavailableError extends Error {
	constructor() {
		super(EMAIL_ADDRESS_UNAVAILABLE_MESSAGE);
		this.name = "ProfileSecurityEmailUnavailableError";
	}
}

export type ProfileSecurityServiceConfig = {
	appBaseUrl: string;
	emailChangeTtlSeconds?: number;
	nowSeconds?: () => number;
	nowMilliseconds?: () => number;
	generateToken?: () => string;
};

export interface ProfileSecurityIdentityProvider {
	updateProfileName(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}): Promise<void>;
	authenticateUser(args: {
		emailNormalized: string;
		password: string;
	}): Promise<unknown>;
	updateProfileEmail(args: {
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}): Promise<void>;
	setProfilePassword(args: {
		emailNormalized: string;
		password: string;
	}): Promise<void>;
	invalidateCognitoSessions(args: { emailNormalized: string }): Promise<void>;
}

export interface ProfileSecurityRepository {
	getProfileByEmail(
		emailNormalized: string,
	): Promise<AppProfileRecord | null>;
	updateProfileName(args: {
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
	findProfileByPendingEmailTokenHash(
		tokenHash: string,
	): Promise<AppProfileRecord | null>;
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

export interface ProfileSecurityEmailSender {
	sendEmailChangeVerificationEmail(email: {
		to: string;
		verificationUrl: string;
		expiresInHours: number;
	}): Promise<void>;
	sendPasswordChangedEmail(email: { to: string }): Promise<void>;
}

export type ProfileSecurityNameServiceResult =
	| { status: "name_updated"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: ProfileSecurityNameFieldErrors;
};

export type ProfileSecurityEmailChangeRequestServiceResult =
	| { status: "verification_sent"; message: string; pendingEmail: string }
	| { status: "same_email"; message: string }
	| { status: "email_unavailable"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: ProfileSecurityEmailChangeFieldErrors;
	  };

export type ProfileSecurityEmailChangeVerificationServiceResult =
	| {
			status: "verified_current_session_kept";
			message: string;
			profile: AppProfileRecord;
	  }
	| { status: "verified_sign_in_required"; message: string }
	| { status: "invalid"; message: string }
	| { status: "expired"; message: string }
	| { status: "already_used"; message: string };

export type ProfileSecurityPasswordChangeServiceResult =
	| { status: "password_changed"; message: string }
	| { status: "invalid_current_password"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: ProfileSecurityPasswordChangeFieldErrors;
	  };

const DEFAULT_EMAIL_CHANGE_TTL_SECONDS = 24 * 60 * 60;

export class ProfileSecurityService {
	private readonly config: Required<
		Omit<ProfileSecurityServiceConfig, "generateToken">
	> &
		Pick<ProfileSecurityServiceConfig, "generateToken">;

	constructor(
		private readonly identity: ProfileSecurityIdentityProvider,
		private readonly profiles: ProfileSecurityRepository,
		private readonly email: ProfileSecurityEmailSender,
		config: ProfileSecurityServiceConfig,
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
		profile: AppProfileRecord,
		input: ProfileSecurityNameInput,
	): Promise<ProfileSecurityNameServiceResult> {
		const parsed = parseProfileSecurityNameInput(input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		const now = this.config.nowSeconds();

		await this.identity.updateProfileName({
			emailNormalized: profile.emailNormalized,
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			fullName: parsed.data.fullName,
		});
		await this.profiles.updateProfileName({
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
		profile: AppProfileRecord,
		input: ProfileSecurityEmailChangeInput,
	): Promise<ProfileSecurityEmailChangeRequestServiceResult> {
		const parsed = parseProfileSecurityEmailChangeInput(input);

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

		const existing = await this.profiles.getProfileByEmail(
			parsed.data.emailNormalized,
		);

		if (existing && existing.profileId !== profile.profileId) {
			return {
				status: "email_unavailable",
				message: EMAIL_ADDRESS_UNAVAILABLE_MESSAGE,
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
		currentSession?: {
			profileId: string;
			token: string | null;
		};
	}): Promise<ProfileSecurityEmailChangeVerificationServiceResult> {
		if (!args.token) {
			return {
				status: "invalid",
				message: "This email change link is invalid.",
			};
		}

		const now = this.config.nowSeconds();
		const tokenHash = hashVerificationToken(args.token);
		const profile =
			await this.profiles.findProfileByPendingEmailTokenHash(tokenHash);

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
			await this.identity.updateProfileEmail({
				currentEmailNormalized: profile.emailNormalized,
				newEmailNormalized: profile.pendingEmail,
			});
		} catch (error) {
			if (error instanceof ProfileSecurityEmailUnavailableError) {
				return {
					status: "invalid",
					message: EMAIL_ADDRESS_UNAVAILABLE_MESSAGE,
				};
			}

			throw error;
		}

		const sessionsInvalidatedAt = this.config.nowMilliseconds();
		const sessionInvalidationExemptToken =
			args.currentSession?.profileId === profile.profileId
				? (args.currentSession.token ?? undefined)
				: undefined;

		await this.identity.invalidateCognitoSessions({
			emailNormalized: profile.pendingEmail,
		});
		await this.profiles.completePendingEmailChange({
			profileId: profile.profileId,
			currentEmailNormalized: profile.emailNormalized,
			newEmailNormalized: profile.pendingEmail,
			verifiedAt: now,
			sessionsInvalidatedAt,
			sessionInvalidationExemptToken,
		});

		if (sessionInvalidationExemptToken) {
			return {
				status: "verified_current_session_kept",
				message: "Your email address has been updated.",
				profile: {
					...profile,
					emailNormalized: profile.pendingEmail,
					emailVerifiedAt: now,
					pendingEmail: undefined,
					pendingEmailVerificationTokenHash: undefined,
					pendingEmailVerificationExpiresAt: undefined,
					pendingEmailVerificationRequestedAt: undefined,
					sessionsInvalidatedAt,
					sessionInvalidationExemptToken,
					updatedAt: now,
				} as AppProfileRecord,
			};
		}

		return {
			status: "verified_sign_in_required",
			message: "Your email address has been updated. Please sign in again.",
		};
	}

	async changePassword(args: {
		profile: AppProfileRecord;
		input: ProfileSecurityPasswordChangeInput;
		currentSessionToken: string | null;
	}): Promise<ProfileSecurityPasswordChangeServiceResult> {
		const parsed = parseProfileSecurityPasswordChangeInput(args.input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		try {
			await this.identity.authenticateUser({
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

		await this.identity.setProfilePassword({
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
