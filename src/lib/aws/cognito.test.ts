import {
	AdminSetUserPasswordCommand,
	AdminUpdateUserAttributesCommand,
	AdminUserGlobalSignOutCommand,
	ConfirmForgotPasswordCommand,
	ForgotPasswordCommand,
	InitiateAuthCommand,
	RespondToAuthChallengeCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { describe, expect, it, vi } from "vitest";
import {
	InvalidPasswordResetCodeError,
	PasswordResetDeliveryUnavailableError,
	PasswordResetRateLimitedError
} from "@/features/auth/password-reset/service";
import { ProfileSecurityEmailUnavailableError } from "@/features/profile-security/service";
import { CognitoAuthAdapter } from "./cognito";

vi.mock("server-only", () => ({}));

class FakeCognitoClient {
	sent: unknown[] = [];
	nextError?: Error;
	nextErrors: Array<Error | undefined> = [];
	nextResponse: unknown = {};

	async send(command: unknown) {
		this.sent.push(command);

		const error = this.nextErrors.length
			? this.nextErrors.shift()
			: this.nextError;

		if (error) {
			throw error;
		}

		return this.nextResponse;
	}
}

function namedError(name: string) {
	const error = new Error(name);
	error.name = name;
	return error;
}

function createHarness() {
	const client = new FakeCognitoClient();
	const adapter = new CognitoAuthAdapter(
		"user-pool-id",
		"user-pool-client-id",
		client as never
	);

	return { adapter, client };
}

describe("CognitoAuthAdapter password reset", () => {
	it("returns a first-login password challenge from Cognito sign-in", async () => {
		const { adapter, client } = createHarness();
		client.nextResponse = {
			ChallengeName: "NEW_PASSWORD_REQUIRED",
			Session: "challenge-session"
		};

		const result = await adapter.authenticateUser({
			emailNormalized: "teacher@example.com",
			password: "Temporary1!"
		});

		expect(client.sent[0]).toBeInstanceOf(InitiateAuthCommand);
		expect((client.sent[0] as InitiateAuthCommand).input).toMatchObject({
			ClientId: "user-pool-client-id",
			AuthFlow: "USER_PASSWORD_AUTH",
			AuthParameters: {
				USERNAME: "teacher@example.com",
				PASSWORD: "Temporary1!"
			}
		});
		expect(result).toEqual({
			challengeName: "NEW_PASSWORD_REQUIRED",
			challengeSession: "challenge-session"
		});
	});

	it("completes Cognito's first-login password challenge", async () => {
		const { adapter, client } = createHarness();
		client.nextResponse = {
			AuthenticationResult: {
				AccessToken: "access-token",
				IdToken: "id-token",
				RefreshToken: "refresh-token",
				ExpiresIn: 3600
			}
		};

		const result = await adapter.completeNewPasswordChallenge({
			emailNormalized: "teacher@example.com",
			newPassword: "Newcase1!",
			challengeSession: "challenge-session"
		});

		expect(client.sent[0]).toBeInstanceOf(RespondToAuthChallengeCommand);
		expect(
			(client.sent[0] as RespondToAuthChallengeCommand).input
		).toMatchObject({
			ClientId: "user-pool-client-id",
			ChallengeName: "NEW_PASSWORD_REQUIRED",
			Session: "challenge-session",
			ChallengeResponses: {
				USERNAME: "teacher@example.com",
				NEW_PASSWORD: "Newcase1!"
			}
		});
		expect(result).toEqual({
			accessToken: "access-token",
			idToken: "id-token",
			refreshToken: "refresh-token",
			expiresIn: 3600
		});
	});

	it("starts Cognito native forgot-password flow", async () => {
		const { adapter, client } = createHarness();
		client.nextResponse = {
			CodeDeliveryDetails: {
				AttributeName: "email",
				DeliveryMedium: "EMAIL",
				Destination: "j***@example.com"
			}
		};

		const result = await adapter.requestPasswordReset({
			emailNormalized: "student@example.com"
		});

		expect(client.sent[0]).toBeInstanceOf(ForgotPasswordCommand);
		expect((client.sent[0] as ForgotPasswordCommand).input).toMatchObject({
			ClientId: "user-pool-client-id",
			Username: "student@example.com"
		});
		expect(result).toEqual({
			delivery: {
				attributeName: "email",
				deliveryMedium: "EMAIL",
				destination: "j***@example.com"
			}
		});
	});

	it("maps Cognito managed forgot-password limits", async () => {
		const { adapter, client } = createHarness();
		client.nextError = namedError("LimitExceededException");

		await expect(
			adapter.requestPasswordReset({
				emailNormalized: "student@example.com"
			})
		).rejects.toBeInstanceOf(PasswordResetRateLimitedError);
	});

	it("maps Cognito missing verified delivery targets to a visible delivery failure", async () => {
		const { adapter, client } = createHarness();
		client.nextError = namedError("InvalidParameterException");

		await expect(
			adapter.requestPasswordReset({
				emailNormalized: "student@example.com"
			})
		).rejects.toBeInstanceOf(PasswordResetDeliveryUnavailableError);
	});

	it("confirms Cognito native forgot-password code", async () => {
		const { adapter, client } = createHarness();

		await adapter.confirmPasswordReset({
			emailNormalized: "student@example.com",
			code: "123456",
			newPassword: "Newcase1!"
		});

		expect(client.sent[0]).toBeInstanceOf(ConfirmForgotPasswordCommand);
		expect(
			(client.sent[0] as ConfirmForgotPasswordCommand).input
		).toMatchObject({
			ClientId: "user-pool-client-id",
			Username: "student@example.com",
			ConfirmationCode: "123456",
			Password: "Newcase1!"
		});
	});

	it("maps invalid, expired, or reused Cognito reset codes", async () => {
		const { adapter, client } = createHarness();
		client.nextError = namedError("ExpiredCodeException");

		await expect(
			adapter.confirmPasswordReset({
				emailNormalized: "student@example.com",
				code: "123456",
				newPassword: "Newcase1!"
			})
		).rejects.toBeInstanceOf(InvalidPasswordResetCodeError);
	});

	it("globally signs out Cognito sessions after reset", async () => {
		const { adapter, client } = createHarness();

		await adapter.invalidateCognitoSessions({
			emailNormalized: "student@example.com"
		});

		expect(client.sent[0]).toBeInstanceOf(AdminUserGlobalSignOutCommand);
		expect(
			(client.sent[0] as AdminUserGlobalSignOutCommand).input
		).toMatchObject({
			UserPoolId: "user-pool-id",
			Username: "student@example.com"
		});
	});

	it("updates Cognito student name attributes", async () => {
		const { adapter, client } = createHarness();

		await adapter.updateProfileName({
			emailNormalized: "student@example.com",
			firstName: "Alex",
			lastName: "Chen",
			fullName: "Alex Chen"
		});

		expect(client.sent[1]).toBeInstanceOf(AdminUpdateUserAttributesCommand);
		expect(
			(client.sent[1] as AdminUpdateUserAttributesCommand).input
		).toMatchObject({
			UserPoolId: "user-pool-id",
			Username: "student@example.com",
			UserAttributes: [
				{ Name: "given_name", Value: "Alex" },
				{ Name: "family_name", Value: "Chen" },
				{ Name: "name", Value: "Alex Chen" }
			]
		});
	});

	it("updates Cognito email and marks it verified only after app verification", async () => {
		const { adapter, client } = createHarness();

		await adapter.updateProfileEmail({
			currentEmailNormalized: "student@example.com",
			newEmailNormalized: "new@example.com"
		});

		expect(client.sent[1]).toBeInstanceOf(AdminUpdateUserAttributesCommand);
		expect(
			(client.sent[1] as AdminUpdateUserAttributesCommand).input
		).toMatchObject({
			UserPoolId: "user-pool-id",
			Username: "student@example.com",
			UserAttributes: [
				{ Name: "email", Value: "new@example.com" },
				{ Name: "email_verified", Value: "true" }
			]
		});
	});

	it("maps Cognito email alias conflicts", async () => {
		const { adapter, client } = createHarness();
		client.nextErrors = [undefined, namedError("AliasExistsException")];

		await expect(
			adapter.updateProfileEmail({
				currentEmailNormalized: "student@example.com",
				newEmailNormalized: "taken@example.com"
			})
		).rejects.toBeInstanceOf(ProfileSecurityEmailUnavailableError);
	});

	it("sets a permanent Cognito password for logged-in password changes", async () => {
		const { adapter, client } = createHarness();

		await adapter.setProfilePassword({
			emailNormalized: "student@example.com",
			password: "Newcase1!"
		});

		expect(client.sent[1]).toBeInstanceOf(AdminSetUserPasswordCommand);
		expect(
			(client.sent[1] as AdminSetUserPasswordCommand).input
		).toMatchObject({
			UserPoolId: "user-pool-id",
			Username: "student@example.com",
			Password: "Newcase1!",
			Permanent: true
		});
	});
});
