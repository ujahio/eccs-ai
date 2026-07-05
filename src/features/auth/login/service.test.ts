import { describe, expect, it } from "vitest";
import {
	InvalidLoginCredentialsError,
	LoginBlockedUntilVerifiedError,
	LoginService,
	type LoginIdentityProvider,
	type LoginProfileRepository
} from "./service";

class FakeLoginIdentity implements LoginIdentityProvider {
	nextError?: Error;

	async authenticateStudent() {
		if (this.nextError) {
			throw this.nextError;
		}

		return { accessToken: "access-token" };
	}
}

class FakeProfileRepository implements LoginProfileRepository {
	hasProfile = true;

	async hasStudentProfile() {
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
			password: "casework1"
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
});
