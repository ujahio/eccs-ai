import { describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import {
	LoginBlockedUntilVerifiedError,
	type AuthSessionTokens,
	type LoginAuthenticationResult,
} from "@/features/auth/login/service";
import type {
	AppProfileRecord,
	StudentProfileRecord,
	TeacherProfileRecord,
} from "@/features/auth/registration/repository";
import { COGNITO_GROUPS } from "@/lib/auth/cognito-groups";
import {
	cognitoSessionBridge,
	type AppSessionProfileRepository,
	type CognitoSessionIdentityProvider,
} from "./cognito-session-bridge";
import type {
	CognitoIdTokenVerifier,
	VerifiedCognitoIdToken,
} from "./cognito-id-token-verifier";

vi.mock("server-only", () => ({}));

const profile: StudentProfileRecord = {
	profileId: "sub-student",
	emailNormalized: "student@example.com",
	firstName: "Jordan",
	lastName: "Adebayo",
	fullName: "Jordan Adebayo",
	role: "student",
	emailVerifiedAt: 1,
	canAccessCases: true,
	createdAt: 1,
	updatedAt: 1,
};

const teacherProfile: TeacherProfileRecord = {
	profileId: "sub-teacher",
	emailNormalized: "teacher@example.com",
	firstName: "Taylor",
	lastName: "Smith",
	fullName: "Taylor Smith",
	role: "teacher",
	emailVerifiedAt: 1,
	createdAt: 1,
	updatedAt: 1,
};

class FakeIdentity implements CognitoSessionIdentityProvider {
	nextError?: Error;
	nextResult: LoginAuthenticationResult = {
		accessToken: "access-token",
		idToken: "id-token",
	};
	completeResult: AuthSessionTokens = {
		accessToken: "access-token",
		idToken: "id-token",
	};

	async authenticateUser() {
		if (this.nextError) {
			throw this.nextError;
		}

		return this.nextResult;
	}

	async completeNewPasswordChallenge() {
		if (this.nextError) {
			throw this.nextError;
		}

		return this.completeResult;
	}
}

class FakeVerifier implements CognitoIdTokenVerifier {
	result: VerifiedCognitoIdToken = {
		cognitoSub: profile.profileId,
		emailNormalized: profile.emailNormalized,
		emailVerified: true,
		groups: [COGNITO_GROUPS.student],
	};

	async verifyIdToken() {
		return this.result;
	}
}

class FakeProfiles implements AppSessionProfileRepository {
	result: AppProfileRecord | null = profile;

	async getAppProfileById() {
		return this.result;
	}
}

function createAuthHarness() {
	const identity = new FakeIdentity();
	const tokenVerifier = new FakeVerifier();
	const profiles = new FakeProfiles();
	const auth = betterAuth({
		baseURL: "http://localhost:3001",
		secret: "test-better-auth-secret-with-enough-entropy",
		session: {
			expiresIn: 8 * 60 * 60,
			disableSessionRefresh: true,
			cookieCache: {
				enabled: true,
				maxAge: 8 * 60 * 60,
				strategy: "jwe",
				refreshCache: false,
			},
		},
		plugins: [
			cognitoSessionBridge({
				appBaseUrl: "http://localhost:3001",
				identity,
				profiles,
				tokenVerifier,
			}),
		],
});

	return {
		auth,
		identity,
		profiles,
		tokenVerifier,
	};
}

type AuthHarness = ReturnType<typeof createAuthHarness>["auth"];

async function postSignIn(auth: AuthHarness, body: unknown) {
	return auth.handler(
		new Request("http://localhost:3001/api/auth/cognito/sign-in", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost:3001",
			},
			body: JSON.stringify(body),
		})
	);
}

async function postFormSignIn(
	auth: AuthHarness,
	body: URLSearchParams,
) {
	return auth.handler(
		new Request("http://localhost:3001/api/auth/cognito/sign-in", {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				accept: "text/html,application/xhtml+xml",
				origin: "http://localhost:3001",
			},
			body,
		})
	);
}

async function postCompleteNewPassword(auth: AuthHarness, body: unknown) {
	return auth.handler(
		new Request("http://localhost:3001/api/auth/cognito/complete-new-password", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost:3001",
			},
			body: JSON.stringify(body),
		})
	);
}

describe("cognitoSessionBridge", () => {
	it("creates a stateless Better Auth session after Cognito validation", async () => {
		const { auth } = createAuthHarness();

		const response = await postSignIn(auth, {
			email: "student@example.com",
			password: "casework1",
		});
		const body = await response.json();

		expect(body).toEqual({
			status: "signed_in",
			redirectTo: "/student",
		});
		expect(response.headers.get("set-cookie")).toContain(
			"better-auth.session"
		);
	});

	it("redirects native form posts after creating the stateless session", async () => {
		const { auth } = createAuthHarness();

		const response = await postFormSignIn(
			auth,
			new URLSearchParams({
				email: "student@example.com",
				password: "casework1",
			}),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3001/student"
		);
		expect(response.headers.get("set-cookie")).toContain(
			"better-auth.session"
		);
	});

	it("creates a teacher session and redirects to the teacher dashboard", async () => {
		const { auth, profiles, tokenVerifier } = createAuthHarness();
		profiles.result = teacherProfile;
		tokenVerifier.result = {
			cognitoSub: teacherProfile.profileId,
			emailNormalized: teacherProfile.emailNormalized,
			emailVerified: true,
			groups: [COGNITO_GROUPS.teacher],
		};

		const response = await postSignIn(auth, {
			email: "teacher@example.com",
			password: "casework1",
		});
		const body = await response.json();

		expect(body).toEqual({
			status: "signed_in",
			redirectTo: "/teacher",
		});
		expect(response.headers.get("set-cookie")).toContain(
			"better-auth.session"
		);
	});

	it("returns a first-login password challenge without creating an app session", async () => {
		const { auth, identity } = createAuthHarness();
		identity.nextResult = {
			challengeName: "NEW_PASSWORD_REQUIRED",
			challengeSession: "challenge-session",
		};

		const response = await postSignIn(auth, {
			email: "teacher@example.com",
			password: "temporary1",
		});
		const body = await response.json();

		expect(body).toEqual({
			status: "new_password_required",
			message: "Set a new password to finish signing in.",
			challengeSession: "challenge-session",
			values: {
				email: "teacher@example.com",
				password: "",
			},
			errors: {},
		});
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("completes a first-login password challenge before creating a teacher session", async () => {
		const { auth, profiles, tokenVerifier } = createAuthHarness();
		profiles.result = teacherProfile;
		tokenVerifier.result = {
			cognitoSub: teacherProfile.profileId,
			emailNormalized: teacherProfile.emailNormalized,
			emailVerified: true,
			groups: [COGNITO_GROUPS.teacher],
		};

		const response = await postCompleteNewPassword(auth, {
			email: "teacher@example.com",
			password: "newcase1",
			confirmPassword: "newcase1",
			challengeSession: "challenge-session",
		});
		const body = await response.json();

		expect(body).toEqual({
			status: "signed_in",
			redirectTo: "/teacher",
		});
		expect(response.headers.get("set-cookie")).toContain(
			"better-auth.session"
		);
	});

	it("keeps unverified Cognito users blocked", async () => {
		const { auth, identity } = createAuthHarness();
		identity.nextError = new LoginBlockedUntilVerifiedError();

		const response = await postSignIn(auth, {
			email: "student@example.com",
			password: "casework1",
		});
		const body = await response.json();

		expect(body.status).toBe("verify_email");
		expect(body.message).toBe("Verify your email before signing in.");
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("redirects native form posts back to login when verification is required", async () => {
		const { auth, identity } = createAuthHarness();
		identity.nextError = new LoginBlockedUntilVerifiedError();

		const response = await postFormSignIn(
			auth,
			new URLSearchParams({
				email: "student@example.com",
				password: "casework1",
			}),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3001/login?auth=verify_email"
		);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("fails closed when the DynamoDB student profile is missing", async () => {
		const { auth, profiles } = createAuthHarness();
		profiles.result = null;

		const response = await postSignIn(auth, {
			email: "student@example.com",
			password: "casework1",
		});
		const body = await response.json();

		expect(body.status).toBe("invalid_credentials");
		expect(body.message).toBe(
			"We couldn’t sign you in with those details. Check your email and password and try again."
		);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("fails closed when Cognito has not authorized the student group", async () => {
		const { auth, tokenVerifier } = createAuthHarness();
		tokenVerifier.result = {
			...tokenVerifier.result,
			groups: [],
		};

		const response = await postSignIn(auth, {
			email: "student@example.com",
			password: "casework1",
		});
		const body = await response.json();

		expect(body.status).toBe("invalid_credentials");
		expect(body.message).toBe(
			"We couldn’t sign you in with those details. Check your email and password and try again."
		);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("fails closed when Cognito and DynamoDB roles do not match", async () => {
		const { auth, tokenVerifier } = createAuthHarness();
		tokenVerifier.result = {
			...tokenVerifier.result,
			groups: [COGNITO_GROUPS.teacher],
		};

		const response = await postSignIn(auth, {
			email: "student@example.com",
			password: "casework1",
		});
		const body = await response.json();

		expect(body.status).toBe("invalid_credentials");
		expect(body.message).toBe(
			"We couldn’t sign you in with those details. Check your email and password and try again."
		);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	it("fails closed when Cognito includes multiple known role groups", async () => {
		const { auth, tokenVerifier } = createAuthHarness();
		tokenVerifier.result = {
			...tokenVerifier.result,
			groups: [COGNITO_GROUPS.student, COGNITO_GROUPS.teacher],
		};

		const response = await postSignIn(auth, {
			email: "student@example.com",
			password: "casework1",
		});
		const body = await response.json();

		expect(body.status).toBe("invalid_credentials");
		expect(body.message).toBe(
			"We couldn’t sign you in with those details. Check your email and password and try again."
		);
		expect(response.headers.get("set-cookie")).toBeNull();
	});
});
