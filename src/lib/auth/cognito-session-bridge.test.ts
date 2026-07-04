import { describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { LoginBlockedUntilVerifiedError } from "@/features/auth/login/service";
import type { StudentProfileRecord } from "@/features/auth/registration/repository";
import {
	cognitoSessionBridge,
	type CognitoSessionIdentityProvider,
	type StudentSessionProfileRepository,
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

class FakeIdentity implements CognitoSessionIdentityProvider {
	nextError?: Error;

	async authenticateStudent() {
		if (this.nextError) {
			throw this.nextError;
		}

		return {
			accessToken: "access-token",
			idToken: "id-token",
		};
	}
}

class FakeVerifier implements CognitoIdTokenVerifier {
	result: VerifiedCognitoIdToken = {
		cognitoSub: profile.profileId,
		emailNormalized: profile.emailNormalized,
		emailVerified: true,
		groups: ["student"],
	};

	async verifyIdToken() {
		return this.result;
	}
}

class FakeProfiles implements StudentSessionProfileRepository {
	result: StudentProfileRecord | null = profile;

	async getStudentProfileById() {
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
			message: "Signed in.",
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

		expect(body.status).toBe("missing_profile");
		expect(body.message).toBe("We could not load your account profile.");
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

		expect(body.status).toBe("unauthorized_role");
		expect(body.message).toBe("This sign-in area is for student accounts.");
		expect(response.headers.get("set-cookie")).toBeNull();
	});
});
