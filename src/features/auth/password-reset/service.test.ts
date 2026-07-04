import { describe, expect, it } from "vitest";
import type { PasswordResetEmailSender } from "./email";
import {
	InvalidPasswordResetCodeError,
	PasswordResetDeliveryUnavailableError,
	PasswordResetRateLimitedError,
	PasswordResetService,
	PasswordResetUserNotFoundError,
	type AppSessionInvalidator,
	type PasswordResetIdentityProvider,
	type PasswordResetProfileRepository
} from "./service";

class FakeIdentity implements PasswordResetIdentityProvider {
	requests: string[] = [];
	confirms: Array<{
		emailNormalized: string;
		code: string;
		newPassword: string;
	}> = [];
	globalSignOuts: string[] = [];
	requestError?: Error;
	confirmError?: Error;
	resetCode?: string;

	async requestPasswordReset(args: { emailNormalized: string }) {
		this.requests.push(args.emailNormalized);

		if (this.requestError) {
			throw this.requestError;
		}

		return { resetCode: this.resetCode };
	}

	async confirmPasswordReset(args: {
		emailNormalized: string;
		code: string;
		newPassword: string;
	}) {
		this.confirms.push(args);

		if (this.confirmError) {
			throw this.confirmError;
		}
	}

	async invalidateCognitoSessions(args: { emailNormalized: string }) {
		this.globalSignOuts.push(args.emailNormalized);
	}
}

class FakeProfiles implements PasswordResetProfileRepository {
	profile: { profileId: string; emailNormalized: string } | null = {
		profileId: "profile-1",
		emailNormalized: "student@example.com"
	};

	async getStudentProfileByEmail() {
		return this.profile;
	}
}

class FakeSessions implements AppSessionInvalidator {
	invalidated: Array<{ userId: string; invalidatedAt: number }> = [];

	async invalidateSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
	}) {
		this.invalidated.push(args);
	}
}

class FakeEmail implements PasswordResetEmailSender {
	resetEmails: Array<{
		to: string;
		resetUrl: string;
		expiresInMinutes: number;
	}> = [];
	changedEmails: Array<{ to: string }> = [];

	async sendPasswordResetCodeEmail(email: {
		to: string;
		resetUrl: string;
		expiresInMinutes: number;
	}) {
		this.resetEmails.push(email);
	}

	async sendPasswordChangedEmail(email: { to: string }) {
		this.changedEmails.push(email);
	}
}

function createHarness() {
	const identity = new FakeIdentity();
	const profiles = new FakeProfiles();
	const sessions = new FakeSessions();
	const email = new FakeEmail();
	const service = new PasswordResetService(
		identity,
		profiles,
		sessions,
		email,
		{
			appBaseUrl: "https://eccs.example",
			now: () => 5_000
		}
	);

	return { email, identity, profiles, service, sessions };
}

describe("PasswordResetService", () => {
	const resetRequestedMessage =
		"If this account exists and has a verified email, a reset link has been sent. If you do not receive one, verify your email or contact support.";

	it("requests Cognito password reset and keeps unknown accounts private", async () => {
		const { identity, service } = createHarness();
		identity.requestError = new PasswordResetUserNotFoundError();

		const result = await service.requestPasswordReset({
			email: "Student@Example.COM"
		});

		expect(identity.requests).toEqual(["student@example.com"]);
		expect(result).toEqual({
			status: "reset_requested",
			message: resetRequestedMessage
		});
	});

	it("sends a code-only reset URL when the memory harness returns a code", async () => {
		const { email, identity, service } = createHarness();
		identity.resetCode = "123456";

		await service.requestPasswordReset({
			email: "student@example.com"
		});

		expect(email.resetEmails).toHaveLength(1);
		const resetUrl = new URL(email.resetEmails[0].resetUrl);

		expect(resetUrl.pathname).toBe("/reset-password");
		expect(resetUrl.searchParams.get("code")).toBe("123456");
		expect(resetUrl.searchParams.has("email")).toBe(false);
	});

	it("maps Cognito managed attempt limits", async () => {
		const { identity, service } = createHarness();
		identity.requestError = new PasswordResetRateLimitedError();

		const result = await service.requestPasswordReset({
			email: "student@example.com"
		});

		expect(result).toEqual({
			status: "rate_limited",
			message: "Too many password reset requests. Try again later."
		});
	});

	it("surfaces Cognito delivery failures instead of reporting quiet success", async () => {
		const { identity, service } = createHarness();
		identity.requestError = new PasswordResetDeliveryUnavailableError();

		const result = await service.requestPasswordReset({
			email: "student@example.com"
		});

		expect(result).toEqual({
			status: "delivery_unavailable",
			message: resetRequestedMessage
		});
	});

	it("confirms reset, globally signs out Cognito, invalidates app sessions, and sends confirmation email", async () => {
		const { email, identity, service, sessions } = createHarness();

		const result = await service.confirmPasswordReset({
			email: "student@example.com",
			code: "123456",
			password: "newcase1",
			confirmPassword: "newcase1"
		});

		expect(identity.confirms).toEqual([
			{
				emailNormalized: "student@example.com",
				code: "123456",
				newPassword: "newcase1"
			}
		]);
		expect(identity.globalSignOuts).toEqual(["student@example.com"]);
		expect(sessions.invalidated).toEqual([
			{
				userId: "profile-1",
				invalidatedAt: 5_000
			}
		]);
		expect(email.changedEmails).toEqual([{ to: "student@example.com" }]);
		expect(result).toEqual({
			status: "password_reset",
			message: "Your password was changed. Please sign in."
		});
	});

	it("rejects invalid, expired, or reused reset codes", async () => {
		const { identity, service } = createHarness();
		identity.confirmError = new InvalidPasswordResetCodeError();

		const result = await service.confirmPasswordReset({
			email: "student@example.com",
			code: "bad-code",
			password: "newcase1",
			confirmPassword: "newcase1"
		});

		expect(result).toEqual({
			status: "invalid_code",
			message:
				"This reset link is invalid, expired, or already used. Request a new reset link."
		});
	});

	it("validates matching Cognito password policy requirements before confirm", async () => {
		const { identity, service } = createHarness();

		const result = await service.confirmPasswordReset({
			email: "student@example.com",
			code: "123456",
			password: "short",
			confirmPassword: "different"
		});

		expect(identity.confirms).toHaveLength(0);
		expect(result).toMatchObject({
			status: "validation_error",
			fieldErrors: {
				password: "Password is missing: at least 8 characters, at least one number.",
				confirmPassword: "Passwords do not match."
			}
		});
	});
});
