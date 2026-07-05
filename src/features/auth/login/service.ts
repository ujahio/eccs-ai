import { parseLoginInput, type LoginFieldErrors, type LoginInput } from "./schema";

export type AuthSessionTokens = {
	accessToken: string;
	idToken?: string;
	refreshToken?: string;
	expiresIn?: number;
};

export type LoginFailureReason =
	| "invalid_credentials"
	| "verify_email"
	| "missing_profile";

export class LoginBlockedUntilVerifiedError extends Error {
	constructor() {
		super("Verify your email before signing in.");
		this.name = "LoginBlockedUntilVerifiedError";
	}
}

export class InvalidLoginCredentialsError extends Error {
	constructor() {
		super("Invalid email or password.");
		this.name = "InvalidLoginCredentialsError";
	}
}

export interface LoginIdentityProvider {
	authenticateStudent(args: {
		emailNormalized: string;
		password: string;
	}): Promise<AuthSessionTokens>;
}

export interface LoginProfileRepository {
	hasStudentProfile(emailNormalized: string): Promise<boolean>;
}

export type LoginServiceResult =
	| { status: "signed_in"; tokens: AuthSessionTokens }
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
			const tokens = await this.identity.authenticateStudent({
				emailNormalized: parsed.data.emailNormalized,
				password: parsed.data.password
			});
			const hasProfile = await this.profiles.hasStudentProfile(
				parsed.data.emailNormalized
			);

			if (!hasProfile) {
				return {
					status: "missing_profile",
					message: "We could not load your account profile."
				};
			}

			return {
				status: "signed_in",
				tokens
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
					message: "Invalid email or password."
				};
			}

			throw error;
		}
	}
}
