import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	decrypt: vi.fn(),
	resendSend: vi.fn()
}));

vi.mock("@aws-crypto/client-node", () => ({
	CommitmentPolicy: {
		REQUIRE_ENCRYPT_ALLOW_DECRYPT: "REQUIRE_ENCRYPT_ALLOW_DECRYPT"
	},
	KmsKeyringNode: vi.fn(function (this: unknown, args: unknown) {
		return args;
	}),
	buildClient: vi.fn(() => ({
		decrypt: mocks.decrypt
	}))
}));

vi.mock("resend", () => ({
	Resend: vi.fn(function () {
		return {
			emails: {
				send: mocks.resendSend
			}
		};
	})
}));

vi.mock("sst", () => ({
	Resource: {
		ResendApiKey: {
			value: "test-resend-key"
		}
	}
}));

import { handler, resetPasswordUrl } from "./custom-email-sender";

describe("resetPasswordUrl", () => {
	const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

	beforeEach(() => {
		mocks.decrypt.mockReset();
		mocks.resendSend.mockReset();
	});

	afterEach(() => {
		process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
		delete process.env.COGNITO_CUSTOM_SENDER_KEY_ARN;
		delete process.env.ECCS_EMAIL_SENDER;
	});

	it("builds a reset link with the Cognito code and no email address", () => {
		process.env.NEXT_PUBLIC_APP_URL = "https://eccs.example";

		const url = new URL(resetPasswordUrl("123456"));

		expect(url.origin).toBe("https://eccs.example");
		expect(url.pathname).toBe("/reset-password");
		expect(url.searchParams.get("code")).toBe("123456");
		expect(url.searchParams.has("email")).toBe(false);
	});

	it("decrypts Cognito forgot-password codes and sends a Resend reset email", async () => {
		process.env.COGNITO_CUSTOM_SENDER_KEY_ARN =
			"arn:aws:kms:us-east-1:123456789012:key/reset";
		process.env.NEXT_PUBLIC_APP_URL = "https://eccs.example";
		process.env.ECCS_EMAIL_SENDER = "ECCS <no-reply@example.com>";
		mocks.decrypt.mockResolvedValue({
			plaintext: Buffer.from("654321")
		});

		await handler({
			triggerSource: "CustomEmailSender_ForgotPassword",
			request: {
				code: Buffer.from("encrypted-code").toString("base64"),
				userAttributes: {
					email: "student@example.com"
				}
			}
		});

		expect(mocks.decrypt).toHaveBeenCalledOnce();
		expect(mocks.resendSend).toHaveBeenCalledOnce();

		const email = mocks.resendSend.mock.calls[0][0];

		expect(email).toMatchObject({
			from: "ECCS <no-reply@example.com>",
			to: "student@example.com",
			subject: "Reset your ECCS password"
		});
		expect(email.text).toContain(
			"https://eccs.example/reset-password?code=654321"
		);
		expect(email.text).not.toContain("student@example.com");
		expect(email.text).not.toContain("student%40example.com");
	});
});
