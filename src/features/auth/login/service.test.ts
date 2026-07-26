import { describe, expect, it } from "vitest";
import {
	InvalidLoginCredentialsError,
	LoginBlockedUntilVerifiedError,
	LoginService,
	type LoginAuthenticationResult,
	type LoginIdentityProvider,
	type LoginProfileRepository
} from "./service";

class FakeLoginIdentity implements LoginIdentityProvider {
	nextError?: Error;
	nextResult: LoginAuthenticationResult = { accessToken: "access-token" };

	async authenticateUser() {
		if (this.nextError) {
			throw this.nextError;
		}

		return this.nextResult;
	}
}

class FakeProfileRepository implements LoginProfileRepository {
	hasProfile = true;

	async hasAppProfile() {
		return this.hasProfile;
	}
}

describe("LoginService", () => {
	it("maps unverified Cognito users to the required blocked login message", async () => {
		const identity = new FakeLoginIdentity();
		identity.nextError = new LoginBlockedUntilVerifiedError();
		const service = new LoginService(identity, new FakeProfileRepository());

		const result = await service.login({
			email: "student@example.com",
			password: "Casework1!"
		});

		expect(result).toEqual({
			status: "verify_email",
			message: "Verify your email before signing in."
		});
	});

	it("keeps invalid credential failures short", async () => {
		const identity = new FakeLoginIdentity();
		identity.nextError = new InvalidLoginCredentialsError();
		const service = new LoginService(identity, new FakeProfileRepository());

		const result = await service.login({
			email: "student@example.com",
			password: "wrongpass"
		});

		expect(result).toEqual({
			status: "invalid_credentials",
			message:
				"We couldn’t sign you in with those details. Check your email and password and try again."
		});
	});

	it("returns a first-login password challenge without signing in", async () => {
		const identity = new FakeLoginIdentity();
		identity.nextResult = {
			challengeName: "NEW_PASSWORD_REQUIRED",
			challengeSession: "challenge-session",
		};
		const service = new LoginService(identity, new FakeProfileRepository());

		const result = await service.login({
			email: "teacher@example.com",
			password: "Temporary1!",
		});

		expect(result).toEqual({
			status: "new_password_required",
			challengeSession: "challenge-session",
		});
	});
});
