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
	type LoginAuthenticationResult,
	isNewPasswordRequiredChallenge,
} from "@/features/auth/login/service";
import { GENERIC_SIGN_IN_ERROR_MESSAGE } from "@/features/auth/login/messages";
import {
	parseCompleteNewPasswordInput,
	parseLoginInput,
} from "@/features/auth/login/schema";
import type {
	CognitoCompleteNewPasswordResponse,
	CognitoSessionBridgeStatus,
	CognitoSignInResponse,
} from "@/features/auth/login/api";
import type { AppProfileRecord } from "@/features/auth/registration/repository";
import { roleFromCognitoGroups } from "@/lib/auth/cognito-groups";
import { redirectPathForRole } from "@/lib/auth/roles";
import type { CognitoIdTokenVerifier } from "./cognito-id-token-verifier";

type AuthEndpointContext = Parameters<typeof setSessionCookie>[0];

export interface CognitoSessionIdentityProvider {
	authenticateUser(args: {
		emailNormalized: string;
		password: string;
	}): Promise<LoginAuthenticationResult>;
	completeNewPasswordChallenge(args: {
		emailNormalized: string;
		newPassword: string;
		challengeSession: string;
	}): Promise<AuthSessionTokens>;
}

export interface AppSessionProfileRepository {
	getAppProfileById(
		profileId: string,
	): Promise<AppProfileRecord | null>;
}

export type CognitoSessionBridgeOptions = {
	appBaseUrl: string;
	identity: CognitoSessionIdentityProvider;
	profiles: AppSessionProfileRepository;
	tokenVerifier: CognitoIdTokenVerifier;
	trustedOrigins?: string[];
};

const signInBodySchema = z.object({
	email: z.string().optional(),
	password: z.string().optional(),
});

const completeNewPasswordBodySchema = z.object({
	email: z.string().optional(),
	password: z.string().optional(),
	confirmPassword: z.string().optional(),
	challengeSession: z.string().optional(),
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
						const authResult = await options.identity.authenticateUser({
							emailNormalized: parsed.data.emailNormalized,
							password: parsed.data.password,
						});

						if (isNewPasswordRequiredChallenge(authResult)) {
							return bridgeResponse(ctx, options, {
								status: "new_password_required",
								message: "Set a new password to finish signing in.",
								challengeSession: authResult.challengeSession,
								values: { email: input.email, password: "" },
								errors: {},
							} satisfies CognitoSignInResponse);
						}

						const response = await createSessionFromTokens(ctx, options, {
							emailNormalized: parsed.data.emailNormalized,
							tokens: authResult,
							input,
						});

						return bridgeResponse(ctx, options, response);
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
									GENERIC_SIGN_IN_ERROR_MESSAGE,
									input,
								),
							);
						}

						throw error;
					}
				},
			),
			cognitoCompleteNewPassword: createAuthEndpoint(
				"/cognito/complete-new-password",
				{
					method: "POST",
					body: completeNewPasswordBodySchema,
					metadata: {
						allowedMediaTypes: ["application/json"],
					},
					requireRequest: true,
				},
				async (ctx) => {
					const input = {
						email: ctx.body.email ?? "",
						password: ctx.body.password ?? "",
						confirmPassword: ctx.body.confirmPassword ?? "",
						challengeSession: ctx.body.challengeSession ?? "",
					};
					const parsed = parseCompleteNewPasswordInput(input);

					if (!isSameOriginRequest(ctx.request.headers, options)) {
						return ctx.json(
							completePasswordFailure(
								"invalid_request",
								"Invalid password completion request.",
								input.email,
							),
						);
					}

					if (!parsed.success) {
						return ctx.json({
							status: "validation_error",
							message: "Check the highlighted fields and try again.",
							values: {
								email: input.email,
								password: "",
								confirmPassword: "",
							},
							errors: toFormErrors(parsed.fieldErrors),
						} satisfies CognitoCompleteNewPasswordResponse);
					}

					try {
						const tokens =
							await options.identity.completeNewPasswordChallenge({
								emailNormalized: parsed.data.emailNormalized,
								newPassword: parsed.data.password,
								challengeSession: parsed.data.challengeSession,
							});
						const response = await createSessionFromTokens(ctx, options, {
							emailNormalized: parsed.data.emailNormalized,
							tokens,
							input: {
								email: input.email,
								password: "",
							},
						});

						return ctx.json(
							toCompletePasswordResponse(response, input.email),
						);
					} catch (error) {
						if (error instanceof LoginBlockedUntilVerifiedError) {
							return ctx.json(
								completePasswordFailure(
									"verify_email",
									"Verify your email before signing in.",
									input.email,
								),
							);
						}

						if (error instanceof InvalidLoginCredentialsError) {
							return ctx.json(
								completePasswordFailure(
									"invalid_credentials",
									GENERIC_SIGN_IN_ERROR_MESSAGE,
									input.email,
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

async function createSessionFromTokens(
	ctx: AuthEndpointContext,
	options: CognitoSessionBridgeOptions,
	args: {
		emailNormalized: string;
		tokens: AuthSessionTokens;
		input: { email: string; password: string };
	},
): Promise<CognitoSignInResponse> {
	if (!args.tokens.idToken) {
		return failure(
			"invalid_credentials",
			GENERIC_SIGN_IN_ERROR_MESSAGE,
			args.input,
		);
	}

	const verified = await options.tokenVerifier.verifyIdToken(args.tokens.idToken);

	if (!verified.emailVerified) {
		return failure("verify_email", "Verify your email before signing in.", args.input);
	}

	if (verified.emailNormalized !== args.emailNormalized) {
		return failure(
			"invalid_credentials",
			GENERIC_SIGN_IN_ERROR_MESSAGE,
			args.input,
		);
	}

	const role = roleFromCognitoGroups(verified.groups);

	if (!role) {
		return failure(
			"invalid_credentials",
			GENERIC_SIGN_IN_ERROR_MESSAGE,
			args.input,
		);
	}

	const profile = await options.profiles.getAppProfileById(verified.cognitoSub);

	if (!profile || profile.emailNormalized !== verified.emailNormalized) {
		return failure(
			"invalid_credentials",
			GENERIC_SIGN_IN_ERROR_MESSAGE,
			args.input,
		);
	}

	if (profile.role !== role) {
		return failure(
			"invalid_credentials",
			GENERIC_SIGN_IN_ERROR_MESSAGE,
			args.input,
		);
	}

	const user = await upsertBetterAuthUser(ctx, profile);
	const session = await ctx.context.internalAdapter.createSession(user.id);

	await setSessionCookie(ctx, { session, user });

	return {
		status: "signed_in",
		redirectTo: redirectPathForRole(profile.role),
	};
}

async function upsertBetterAuthUser(
	ctx: AuthEndpointContext,
	profile: AppProfileRecord,
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
	status: Exclude<
		CognitoSessionBridgeStatus,
		"signed_in" | "new_password_required" | "validation_error"
	>,
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

function completePasswordFailure(
	status: Exclude<
		CognitoCompleteNewPasswordResponse["status"],
		"signed_in" | "validation_error"
	>,
	message: string,
	email: string,
): CognitoCompleteNewPasswordResponse {
	return {
		status,
		message,
		values: {
			email,
			password: "",
			confirmPassword: "",
		},
		errors: {},
	};
}

function toCompletePasswordResponse(
	response: CognitoSignInResponse,
	email: string,
): CognitoCompleteNewPasswordResponse {
	if (response.status === "signed_in") {
		return response;
	}

	if (response.status === "new_password_required") {
		return completePasswordFailure(
			"invalid_credentials",
			GENERIC_SIGN_IN_ERROR_MESSAGE,
			email,
		);
	}

	if (response.status === "validation_error") {
		return {
			status: "validation_error",
			message: response.message,
			values: {
				email,
				password: "",
				confirmPassword: "",
			},
			errors: {},
		};
	}

	return completePasswordFailure(response.status, response.message, email);
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
