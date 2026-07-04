import type { PasswordResetEmailSender } from "./email";
import {
	parsePasswordResetConfirmInput,
	parsePasswordResetRequestInput,
	type PasswordResetConfirmFieldErrors,
	type PasswordResetConfirmInput,
	type PasswordResetRequestFieldErrors,
	type PasswordResetRequestInput,
} from "./schema";

export class PasswordResetRateLimitedError extends Error {
	constructor() {
		super("Too many password reset attempts.");
		this.name = "PasswordResetRateLimitedError";
	}
}

export class InvalidPasswordResetCodeError extends Error {
	constructor() {
		super("Invalid password reset code.");
		this.name = "InvalidPasswordResetCodeError";
	}
}

export class PasswordResetUserNotFoundError extends Error {
	constructor() {
		super("Password reset user not found.");
		this.name = "PasswordResetUserNotFoundError";
	}
}

export class PasswordResetDeliveryUnavailableError extends Error {
	constructor() {
		super("Password reset delivery is unavailable.");
		this.name = "PasswordResetDeliveryUnavailableError";
	}
}

export type PasswordResetDeliveryDetails = {
	attributeName?: string;
	deliveryMedium?: string;
	destination?: string;
};

export interface PasswordResetIdentityProvider {
	requestPasswordReset(args: {
		emailNormalized: string;
	}): Promise<{
		resetCode?: string;
		delivery?: PasswordResetDeliveryDetails;
	}>;
	confirmPasswordReset(args: {
		emailNormalized: string;
		code: string;
		newPassword: string;
	}): Promise<void>;
	invalidateCognitoSessions(args: { emailNormalized: string }): Promise<void>;
}

export interface PasswordResetProfileRepository {
	getStudentProfileByEmail(
		emailNormalized: string,
	): Promise<{ profileId: string; emailNormalized: string } | null>;
}

export interface AppSessionInvalidator {
	invalidateSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
	}): Promise<void>;
}

export type PasswordResetServiceConfig = {
	appBaseUrl: string;
	resetCodeTtlMinutes?: number;
	now?: () => number;
};

const PASSWORD_RESET_REQUESTED_MESSAGE =
	"If this account exists and has a verified email, a reset link has been sent. If you do not receive one, verify your email or contact support.";

export type PasswordResetRequestServiceResult =
	| { status: "reset_requested"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: PasswordResetRequestFieldErrors;
	  }
	| { status: "rate_limited"; message: string }
	| { status: "delivery_unavailable"; message: string };

export type PasswordResetConfirmServiceResult =
	| { status: "password_reset"; message: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: PasswordResetConfirmFieldErrors;
	  }
	| { status: "invalid_code"; message: string }
	| { status: "rate_limited"; message: string };

export class PasswordResetService {
	private readonly config: Required<PasswordResetServiceConfig>;

	constructor(
		private readonly identity: PasswordResetIdentityProvider,
		private readonly profiles: PasswordResetProfileRepository,
		private readonly sessions: AppSessionInvalidator,
		private readonly email: PasswordResetEmailSender,
		config: PasswordResetServiceConfig,
	) {
		this.config = {
			appBaseUrl: config.appBaseUrl,
			resetCodeTtlMinutes: config.resetCodeTtlMinutes ?? 60,
			now: config.now ?? (() => Date.now()),
		};
	}

	async requestPasswordReset(
		input: PasswordResetRequestInput,
	): Promise<PasswordResetRequestServiceResult> {
		const parsed = parsePasswordResetRequestInput(input);
		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		try {
			const request = await this.identity.requestPasswordReset({
				emailNormalized: parsed.data.emailNormalized,
			});

			if (request.resetCode) {
				await this.email.sendPasswordResetCodeEmail({
					to: parsed.data.emailNormalized,
					resetUrl: this.resetUrl(request.resetCode),
					expiresInMinutes: this.config.resetCodeTtlMinutes,
				});
			}
		} catch (error) {
			if (error instanceof PasswordResetDeliveryUnavailableError) {
				return {
					status: "delivery_unavailable",
					message: PASSWORD_RESET_REQUESTED_MESSAGE,
				};
			}

			if (error instanceof PasswordResetRateLimitedError) {
				return {
					status: "rate_limited",
					message: "Too many password reset requests. Try again later.",
				};
			}

			if (!(error instanceof PasswordResetUserNotFoundError)) {
				throw error;
			}
		}

		return {
			status: "reset_requested",
			message: PASSWORD_RESET_REQUESTED_MESSAGE,
		};
	}

	async confirmPasswordReset(
		input: PasswordResetConfirmInput,
	): Promise<PasswordResetConfirmServiceResult> {
		const parsed = parsePasswordResetConfirmInput(input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors,
			};
		}

		try {
			await this.identity.confirmPasswordReset({
				emailNormalized: parsed.data.emailNormalized,
				code: parsed.data.code,
				newPassword: parsed.data.password,
			});
		} catch (error) {
			if (error instanceof PasswordResetRateLimitedError) {
				return {
					status: "rate_limited",
					message: "Too many password reset attempts. Try again later.",
				};
			}

			if (
				error instanceof InvalidPasswordResetCodeError ||
				error instanceof PasswordResetUserNotFoundError
			) {
				return {
					status: "invalid_code",
					message:
						"This reset link is invalid, expired, or already used. Request a new reset link.",
				};
			}

			throw error;
		}

		const invalidatedAt = this.config.now();

		await this.identity.invalidateCognitoSessions({
			emailNormalized: parsed.data.emailNormalized,
		});

		const profile = await this.profiles.getStudentProfileByEmail(
			parsed.data.emailNormalized,
		);

		if (profile) {
			await this.sessions.invalidateSessionsForUser({
				userId: profile.profileId,
				invalidatedAt,
			});
		}

		await this.email.sendPasswordChangedEmail({
			to: parsed.data.emailNormalized,
		});

		return {
			status: "password_reset",
			message: "Your password was changed. Please sign in.",
		};
	}

	private resetUrl(code: string) {
		const url = new URL("/reset-password", this.config.appBaseUrl);
		url.searchParams.set("code", code);
		return url.toString();
	}
}
