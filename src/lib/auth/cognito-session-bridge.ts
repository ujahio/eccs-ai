import "server-only";

import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin, User } from "better-auth";
import { z } from "zod";
import { toFormErrors } from "@/features/auth/form-errors";
import {
	InvalidLoginCredentialsError,
	LoginBlockedUntilVerifiedError,
	type AuthSessionTokens,
} from "@/features/auth/login/service";
import { parseLoginInput } from "@/features/auth/login/schema";
import type {
	CognitoSessionBridgeStatus,
	CognitoSignInResponse,
} from "@/features/auth/login/api";
import type { StudentProfileRecord } from "@/features/auth/registration/repository";
import type { CognitoIdTokenVerifier } from "./cognito-id-token-verifier";

type AuthEndpointContext = Parameters<typeof setSessionCookie>[0];

export interface CognitoSessionIdentityProvider {
	authenticateStudent(args: {
		emailNormalized: string;
		password: string;
	}): Promise<AuthSessionTokens>;
}

export interface StudentSessionProfileRepository {
	getStudentProfileById(
		profileId: string,
	): Promise<StudentProfileRecord | null>;
}

export type CognitoSessionBridgeOptions = {
	appBaseUrl: string;
	identity: CognitoSessionIdentityProvider;
	profiles: StudentSessionProfileRepository;
	tokenVerifier: CognitoIdTokenVerifier;
	trustedOrigins?: string[];
};

const signInBodySchema = z.object({
	email: z.string().optional(),
	password: z.string().optional(),
});

export function cognitoSessionBridge(
	options: CognitoSessionBridgeOptions,
): BetterAuthPlugin {
	return {
		id: "cognito-session-bridge",
		endpoints: {
			cognitoSignIn: createAuthEndpoint(
				"/cognito/sign-in",
				{
					method: "POST",
					body: signInBodySchema,
					metadata: {
						allowedMediaTypes: [
							"application/json",
							"application/x-www-form-urlencoded",
							"multipart/form-data",
						],
					},
					requireRequest: true,
				},
				async (ctx) => {
					const input = {
						email: ctx.body.email ?? "",
						password: ctx.body.password ?? "",
					};
					const parsed = parseLoginInput(input);

					if (!isSameOriginRequest(ctx.request.headers, options)) {
						return bridgeResponse(
							ctx,
							options,
							failure("invalid_request", "Invalid sign-in request.", input),
						);
					}

					if (!parsed.success) {
						return bridgeResponse(ctx, options, {
							status: "validation_error",
							message: "Check the highlighted fields and try again.",
							values: { email: input.email, password: "" },
							errors: toFormErrors(parsed.fieldErrors),
						} satisfies CognitoSignInResponse);
					}

					try {
						const tokens = await options.identity.authenticateStudent({
							emailNormalized: parsed.data.emailNormalized,
							password: parsed.data.password,
						});

						if (!tokens.idToken) {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"invalid_credentials",
									"Invalid email or password.",
									input,
								),
							);
						}

						const verified = await options.tokenVerifier.verifyIdToken(
							tokens.idToken,
						);

						if (!verified.emailVerified) {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"verify_email",
									"Verify your email before signing in.",
									input,
								),
							);
						}

						if (verified.emailNormalized !== parsed.data.emailNormalized) {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"invalid_credentials",
									"Invalid email or password.",
									input,
								),
							);
						}

						if (!verified.groups.includes("student")) {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"unauthorized_role",
									"This sign-in area is for student accounts.",
									input,
								),
							);
						}

						const profile = await options.profiles.getStudentProfileById(
							verified.cognitoSub,
						);

						if (
							!profile ||
							profile.emailNormalized !== verified.emailNormalized
						) {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"missing_profile",
									"We could not load your account profile.",
									input,
								),
							);
						}

						if (profile.role !== "student") {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"unauthorized_role",
									"This sign-in area is for student accounts.",
									input,
								),
							);
						}

						const user = await upsertBetterAuthUser(ctx, profile);
						const session = await ctx.context.internalAdapter.createSession(
							user.id,
						);

						await setSessionCookie(ctx, { session, user });

						return bridgeResponse(ctx, options, {
							status: "signed_in",
							message: "Signed in.",
							redirectTo: "/student",
						} satisfies CognitoSignInResponse);
					} catch (error) {
						if (error instanceof LoginBlockedUntilVerifiedError) {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"verify_email",
									"Verify your email before signing in.",
									input,
								),
							);
						}

						if (error instanceof InvalidLoginCredentialsError) {
							return bridgeResponse(
								ctx,
								options,
								failure(
									"invalid_credentials",
									"Invalid email or password.",
									input,
								),
							);
						}

						throw error;
					}
				},
			),
		},
	};
}

async function upsertBetterAuthUser(
	ctx: AuthEndpointContext,
	profile: StudentProfileRecord,
): Promise<User> {
	const userData = {
		id: profile.profileId,
		email: profile.emailNormalized,
		emailVerified: true,
		name: profile.fullName,
	};
	const existingUser = await ctx.context.internalAdapter.findUserById(
		profile.profileId,
	);

	if (existingUser) {
		return (
			(await ctx.context.internalAdapter.updateUser(
				profile.profileId,
				userData,
			)) ?? existingUser
		);
	}

	return ctx.context.internalAdapter.createUser(userData);
}

function bridgeResponse(
	ctx: AuthEndpointContext,
	options: CognitoSessionBridgeOptions,
	response: CognitoSignInResponse,
) {
	const request = requiredRequest(ctx);

	if (!isHtmlFormRequest(request.headers)) {
		return ctx.json(response);
	}

	if (response.status === "signed_in") {
		throw ctx.redirect(
			new URL(
				response.redirectTo,
				redirectBaseUrl(request.headers, options),
			).toString(),
		);
	}

	throw ctx.redirect(
		loginRedirectUrl(
			redirectBaseUrl(request.headers, options),
			response.status,
		),
	);
}

function requiredRequest(ctx: AuthEndpointContext) {
	if (!ctx.request) {
		throw new Error("Cognito sign-in endpoint requires a request context.");
	}

	return ctx.request;
}

function failure(
	status: Exclude<CognitoSessionBridgeStatus, "signed_in" | "validation_error">,
	message: string,
	input: { email: string; password: string },
): CognitoSignInResponse {
	return {
		status,
		message,
		values: {
			email: input.email,
			password: "",
		},
		errors: {},
	};
}

function loginRedirectUrl(
	appBaseUrl: string,
	status: Exclude<CognitoSessionBridgeStatus, "signed_in">,
) {
	const url = new URL("/login", appBaseUrl);
	url.searchParams.set("auth", status);

	return url.toString();
}

function isHtmlFormRequest(headers: Headers) {
	const accept = headers.get("accept") ?? "";
	const contentType = headers.get("content-type") ?? "";

	return (
		accept.includes("text/html") ||
		contentType.includes("application/x-www-form-urlencoded") ||
		contentType.includes("multipart/form-data")
	);
}

function isSameOriginRequest(
	headers: Headers,
	options: CognitoSessionBridgeOptions,
) {
	const origin = headers.get("origin");

	if (origin) {
		return trustedOrigins(options).has(origin);
	}

	const referer = headers.get("referer");

	if (!referer) {
		return true;
	}

	return trustedOrigins(options).has(new URL(referer).origin);
}

function redirectBaseUrl(
	headers: Headers,
	options: CognitoSessionBridgeOptions,
) {
	const origin = headers.get("origin");

	if (origin && trustedOrigins(options).has(origin)) {
		return origin;
	}

	const referer = headers.get("referer");

	if (referer) {
		const refererOrigin = new URL(referer).origin;

		if (trustedOrigins(options).has(refererOrigin)) {
			return refererOrigin;
		}
	}

	return options.appBaseUrl;
}

function trustedOrigins(options: CognitoSessionBridgeOptions) {
	return new Set(
		[options.appBaseUrl, ...(options.trustedOrigins ?? [])].map(
			(origin) => new URL(origin).origin,
		),
	);
}
