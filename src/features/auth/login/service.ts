import { parseLoginInput, type LoginFieldErrors, type LoginInput } from "./schema";
import { GENERIC_SIGN_IN_ERROR_MESSAGE } from "./messages";

export type AuthSessionTokens = {
	accessToken: string;
	idToken?: string;
	refreshToken?: string;
	expiresIn?: number;
};

export type NewPasswordRequiredChallenge = {
	challengeName: "NEW_PASSWORD_REQUIRED";
	challengeSession: string;
};

export type LoginAuthenticationResult =
	| AuthSessionTokens
	| NewPasswordRequiredChallenge;

export type LoginFailureReason =
	| "invalid_credentials"
	| "verify_email";

export class LoginBlockedUntilVerifiedError extends Error {
	constructor() {
		super("Verify your email before signing in.");
		this.name = "LoginBlockedUntilVerifiedError";
	}
}

export class InvalidLoginCredentialsError extends Error {
	constructor() {
		super(GENERIC_SIGN_IN_ERROR_MESSAGE);
		this.name = "InvalidLoginCredentialsError";
	}
}

export interface LoginIdentityProvider {
	authenticateUser(args: {
		emailNormalized: string;
		password: string;
	}): Promise<LoginAuthenticationResult>;
}

export interface LoginProfileRepository {
	hasAppProfile(emailNormalized: string): Promise<boolean>;
}

export type LoginServiceResult =
	| { status: "signed_in"; tokens: AuthSessionTokens }
	| { status: "new_password_required"; challengeSession: string }
	| {
			status: "validation_error";
			message: string;
			fieldErrors: LoginFieldErrors;
	  }
	| { status: LoginFailureReason; message: string };

export class LoginService {
	constructor(
		private readonly identity: LoginIdentityProvider,
		private readonly profiles: LoginProfileRepository
	) {}

	async login(input: LoginInput): Promise<LoginServiceResult> {
		const parsed = parseLoginInput(input);

		if (!parsed.success) {
			return {
				status: "validation_error",
				message: "Check the highlighted fields and try again.",
				fieldErrors: parsed.fieldErrors
			};
		}

		try {
			const authResult = await this.identity.authenticateUser({
				emailNormalized: parsed.data.emailNormalized,
				password: parsed.data.password
			});
			const hasProfile = await this.profiles.hasAppProfile(
				parsed.data.emailNormalized
			);

			if (!hasProfile) {
				return {
					status: "invalid_credentials",
					message: GENERIC_SIGN_IN_ERROR_MESSAGE
				};
			}

			if (isNewPasswordRequiredChallenge(authResult)) {
				return {
					status: "new_password_required",
					challengeSession: authResult.challengeSession
				};
			}

			return {
				status: "signed_in",
				tokens: authResult
			};
		} catch (error) {
			if (error instanceof LoginBlockedUntilVerifiedError) {
				return {
					status: "verify_email",
					message: "Verify your email before signing in."
				};
			}

			if (error instanceof InvalidLoginCredentialsError) {
				return {
					status: "invalid_credentials",
					message: GENERIC_SIGN_IN_ERROR_MESSAGE
				};
			}

			throw error;
		}
	}
}

export function isNewPasswordRequiredChallenge(
	result: LoginAuthenticationResult
): result is NewPasswordRequiredChallenge {
	return "challengeName" in result && result.challengeName === "NEW_PASSWORD_REQUIRED";
}
