import "server-only";

import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminDeleteUserCommand,
	AdminDisableUserCommand,
	AdminEnableUserCommand,
	AdminGetUserCommand,
	AdminListGroupsForUserCommand,
	AdminSetUserPasswordCommand,
	AdminUserGlobalSignOutCommand,
	AdminUpdateUserAttributesCommand,
	CognitoIdentityProviderClient,
	ConfirmForgotPasswordCommand,
	ForgotPasswordCommand,
	InitiateAuthCommand
} from "@aws-sdk/client-cognito-identity-provider";
import {
	InvalidLoginCredentialsError,
	LoginBlockedUntilVerifiedError,
	type LoginIdentityProvider
} from "@/features/auth/login/service";
import {
	InvalidPasswordResetCodeError,
	PasswordResetDeliveryUnavailableError,
	PasswordResetRateLimitedError,
	PasswordResetUserNotFoundError,
	type PasswordResetIdentityProvider
} from "@/features/auth/password-reset/service";
import {
	StudentAlreadyExistsError,
	type CreatePendingStudentInput,
	type CreatePendingStudentResult,
	type RegistrationIdentityProvider
} from "@/features/auth/registration/identity";
import {
	StudentEmailUnavailableError,
	type StudentProfileIdentityProvider
} from "@/features/student/profile-security/service";
import {
	COGNITO_GROUPS,
	hasStudentCognitoGroup
} from "@/lib/auth/cognito-groups";

export class CognitoAuthAdapter
	implements
		RegistrationIdentityProvider,
		LoginIdentityProvider,
		PasswordResetIdentityProvider,
		StudentProfileIdentityProvider
{
	private readonly client: CognitoIdentityProviderClient;

	constructor(
		private readonly userPoolId: string,
		private readonly userPoolClientId: string,
		client = new CognitoIdentityProviderClient({})
	) {
		this.client = client;
	}

	async createPendingStudent(
		input: CreatePendingStudentInput
	): Promise<CreatePendingStudentResult> {
		try {
			const created = await this.client.send(
				new AdminCreateUserCommand({
					UserPoolId: this.userPoolId,
					Username: input.emailNormalized,
					MessageAction: "SUPPRESS",
					UserAttributes: [
						{ Name: "email", Value: input.emailNormalized },
						{ Name: "email_verified", Value: "false" },
						{ Name: "given_name", Value: input.firstName },
						{ Name: "family_name", Value: input.lastName },
						{ Name: "name", Value: `${input.firstName} ${input.lastName}` }
					]
				})
			);

			await this.client.send(
				new AdminSetUserPasswordCommand({
					UserPoolId: this.userPoolId,
					Username: input.emailNormalized,
					Password: input.password,
					Permanent: true
				})
			);
			await this.client.send(
				new AdminDisableUserCommand({
					UserPoolId: this.userPoolId,
					Username: input.emailNormalized
				})
			);

			const sub =
				created.User?.Attributes?.find((attribute) => attribute.Name === "sub")
					?.Value ?? (await this.getUserSub(input.emailNormalized));

			return { cognitoSub: sub };
		} catch (error) {
			if (errorName(error) === "UsernameExistsException") {
				throw new StudentAlreadyExistsError();
			}

			throw error;
		}
	}

	async confirmStudentEmail(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
	}) {
		await this.client.send(
			new AdminUpdateUserAttributesCommand({
				UserPoolId: this.userPoolId,
				Username: args.emailNormalized,
				UserAttributes: [
					{ Name: "email_verified", Value: "true" },
					{ Name: "given_name", Value: args.firstName },
					{ Name: "family_name", Value: args.lastName },
					{ Name: "name", Value: `${args.firstName} ${args.lastName}` }
				]
			})
		);
		await this.client.send(
			new AdminEnableUserCommand({
				UserPoolId: this.userPoolId,
				Username: args.emailNormalized
			})
		);
		await this.client.send(
			new AdminAddUserToGroupCommand({
				UserPoolId: this.userPoolId,
				Username: args.emailNormalized,
				GroupName: COGNITO_GROUPS.student
			})
		);
	}

	async deletePendingStudent(emailNormalized: string) {
		try {
			await this.client.send(
				new AdminDeleteUserCommand({
					UserPoolId: this.userPoolId,
					Username: emailNormalized
				})
			);
		} catch (error) {
			if (errorName(error) !== "UserNotFoundException") {
				throw error;
			}
		}
	}

	async authenticateStudent(args: {
		emailNormalized: string;
		password: string;
	}) {
		try {
			const auth = await this.client.send(
				new InitiateAuthCommand({
					ClientId: this.userPoolClientId,
					AuthFlow: "USER_PASSWORD_AUTH",
					AuthParameters: {
						USERNAME: args.emailNormalized,
						PASSWORD: args.password
					}
				})
			);

			const result = auth.AuthenticationResult;

			if (!result?.AccessToken) {
				throw new InvalidLoginCredentialsError();
			}

			return {
				accessToken: result.AccessToken,
				idToken: result.IdToken,
				refreshToken: result.RefreshToken,
				expiresIn: result.ExpiresIn
			};
		} catch (error) {
			const name = errorName(error);
			const message = error instanceof Error ? error.message : "";

			if (
				name === "UserNotConfirmedException" ||
				/disabled|confirm|verified/i.test(message)
			) {
				throw new LoginBlockedUntilVerifiedError();
			}

			if (
				name === "NotAuthorizedException" ||
				name === "UserNotFoundException"
			) {
				throw new InvalidLoginCredentialsError();
			}

			throw error;
		}
	}

	async isStudentLoginEligible(args: { emailNormalized: string }) {
		try {
			const user = await this.client.send(
				new AdminGetUserCommand({
					UserPoolId: this.userPoolId,
					Username: args.emailNormalized
				})
			);
			const emailVerified = user.UserAttributes?.some(
				(attribute) =>
					attribute.Name === "email_verified" && attribute.Value === "true"
			);

			if (!user.Enabled || !emailVerified) {
				return false;
			}

			const groups = await this.client.send(
				new AdminListGroupsForUserCommand({
					UserPoolId: this.userPoolId,
					Username: args.emailNormalized
				})
			);

			return hasStudentCognitoGroup(
				groups.Groups?.map((group) => group.GroupName ?? "") ?? []
			);
		} catch (error) {
			if (errorName(error) === "UserNotFoundException") {
				return false;
			}

			throw error;
		}
	}

	async requestPasswordReset(args: { emailNormalized: string }) {
		try {
			const response = await this.client.send(
				new ForgotPasswordCommand({
					ClientId: this.userPoolClientId,
					Username: args.emailNormalized
				})
			);

			return {
				delivery: response.CodeDeliveryDetails
					? {
							attributeName: response.CodeDeliveryDetails.AttributeName,
							deliveryMedium: response.CodeDeliveryDetails.DeliveryMedium,
							destination: response.CodeDeliveryDetails.Destination
						}
					: undefined
			};
		} catch (error) {
			const name = errorName(error);

			if (
				name === "LimitExceededException" ||
				name === "TooManyRequestsException"
			) {
				throw new PasswordResetRateLimitedError();
			}

			if (name === "UserNotFoundException") {
				throw new PasswordResetUserNotFoundError();
			}

			if (
				name === "InvalidParameterException" ||
				name === "CodeDeliveryFailureException" ||
				name === "InvalidEmailRoleAccessPolicyException" ||
				name === "InvalidSmsRoleAccessPolicyException"
			) {
				throw new PasswordResetDeliveryUnavailableError();
			}

			throw error;
		}
	}

	async confirmPasswordReset(args: {
		emailNormalized: string;
		code: string;
		newPassword: string;
	}) {
		try {
			await this.client.send(
				new ConfirmForgotPasswordCommand({
					ClientId: this.userPoolClientId,
					Username: args.emailNormalized,
					ConfirmationCode: args.code,
					Password: args.newPassword
				})
			);
		} catch (error) {
			const name = errorName(error);

			if (
				name === "LimitExceededException" ||
				name === "TooManyRequestsException"
			) {
				throw new PasswordResetRateLimitedError();
			}

			if (
				name === "CodeMismatchException" ||
				name === "ExpiredCodeException" ||
				name === "NotAuthorizedException" ||
				name === "UserNotFoundException"
			) {
				throw new InvalidPasswordResetCodeError();
			}

			throw error;
		}
	}

	async invalidateCognitoSessions(args: { emailNormalized: string }) {
		try {
			await this.globalSignOut(args.emailNormalized);
		} catch (error) {
			if (errorName(error) !== "UserNotFoundException") {
				throw error;
			}
		}
	}

	async updateStudentName(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
		fullName: string;
	}) {
		const username = await this.getCognitoUsername(args.emailNormalized);

		await this.client.send(
			new AdminUpdateUserAttributesCommand({
				UserPoolId: this.userPoolId,
				Username: username,
				UserAttributes: [
					{ Name: "given_name", Value: args.firstName },
					{ Name: "family_name", Value: args.lastName },
					{ Name: "name", Value: args.fullName }
				]
			})
		);
	}

	async updateStudentEmail(args: {
		currentEmailNormalized: string;
		newEmailNormalized: string;
	}) {
		const username = await this.getCognitoUsername(args.currentEmailNormalized);

		try {
			await this.client.send(
				new AdminUpdateUserAttributesCommand({
					UserPoolId: this.userPoolId,
					Username: username,
					UserAttributes: [
						{ Name: "email", Value: args.newEmailNormalized },
						{ Name: "email_verified", Value: "true" }
					]
				})
			);
		} catch (error) {
			const name = errorName(error);

			if (name === "AliasExistsException" || name === "UsernameExistsException") {
				throw new StudentEmailUnavailableError();
			}

			throw error;
		}
	}

	async setStudentPassword(args: {
		emailNormalized: string;
		password: string;
	}) {
		const username = await this.getCognitoUsername(args.emailNormalized);

		await this.client.send(
			new AdminSetUserPasswordCommand({
				UserPoolId: this.userPoolId,
				Username: username,
				Password: args.password,
				Permanent: true
			})
		);
	}

	private async getUserSub(emailNormalized: string) {
		const user = await this.client.send(
			new AdminGetUserCommand({
				UserPoolId: this.userPoolId,
				Username: emailNormalized
			})
		);
		const sub = user.UserAttributes?.find((attribute) => attribute.Name === "sub")
			?.Value;

		if (!sub) {
			throw new Error("Cognito user was created without a sub attribute.");
		}

		return sub;
	}

	private async getCognitoUsername(emailNormalized: string) {
		const user = await this.client.send(
			new AdminGetUserCommand({
				UserPoolId: this.userPoolId,
				Username: emailNormalized
			})
		);

		return user.Username ?? emailNormalized;
	}

	private async globalSignOut(username: string) {
		await this.client.send(
			new AdminUserGlobalSignOutCommand({
				UserPoolId: this.userPoolId,
				Username: username
			})
		);
	}
}

function errorName(error: unknown) {
	return error instanceof Error ? error.name : undefined;
}
