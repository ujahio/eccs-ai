import {
	AdminUserGlobalSignOutCommand,
	ConfirmForgotPasswordCommand,
	ForgotPasswordCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { describe, expect, it, vi } from "vitest";
import {
	InvalidPasswordResetCodeError,
	PasswordResetDeliveryUnavailableError,
	PasswordResetRateLimitedError
} from "@/features/auth/password-reset/service";
import { CognitoAuthAdapter } from "./cognito";

vi.mock("server-only", () => ({}));

class FakeCognitoClient {
	sent: unknown[] = [];
	nextError?: Error;
	nextResponse: unknown = {};

	async send(command: unknown) {
		this.sent.push(command);

		if (this.nextError) {
			throw this.nextError;
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
			newPassword: "newcase1"
		});

		expect(client.sent[0]).toBeInstanceOf(ConfirmForgotPasswordCommand);
		expect(
			(client.sent[0] as ConfirmForgotPasswordCommand).input
		).toMatchObject({
			ClientId: "user-pool-client-id",
			Username: "student@example.com",
			ConfirmationCode: "123456",
			Password: "newcase1"
		});
	});

	it("maps invalid, expired, or reused Cognito reset codes", async () => {
		const { adapter, client } = createHarness();
		client.nextError = namedError("ExpiredCodeException");

		await expect(
			adapter.confirmPasswordReset({
				emailNormalized: "student@example.com",
				code: "123456",
				newPassword: "newcase1"
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
});
