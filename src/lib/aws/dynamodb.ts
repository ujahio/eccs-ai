import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	paginateScan,
	PutCommand,
	QueryCommand,
	UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { LoginProfileRepository } from "@/features/auth/login/service";
import type {
	AppSessionInvalidator,
	PasswordResetProfileRepository
} from "@/features/auth/password-reset/service";
import type { ProfileSecurityRepository } from "@/features/profile-security/service";
import type {
	AppProfileRecord,
	PendingRegistrationRecord,
	RegistrationWorkflowRepository,
	StudentProfileRecord
} from "@/features/auth/registration/repository";
import {
	DuplicatePendingRegistrationError,
	VerificationResendLimitExceededError,
	VerificationTokenAlreadyConsumedError
} from "@/features/auth/registration/repository";

export class DynamoAuthRepository
	implements
		RegistrationWorkflowRepository,
		LoginProfileRepository,
		PasswordResetProfileRepository,
		ProfileSecurityRepository,
		AppSessionInvalidator
{
	private readonly documentClient: DynamoDBDocumentClient;

	constructor(
		private readonly registrationTableName: string,
		private readonly profileTableName: string,
		documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
	) {
		this.documentClient = documentClient;
	}

	async getPendingByEmail(emailNormalized: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.registrationTableName,
				Key: { emailNormalized },
				ConsistentRead: true
			})
		);

		return (response.Item as PendingRegistrationRecord | undefined) ?? null;
	}

	async createPendingRegistration(record: PendingRegistrationRecord) {
		try {
			await this.documentClient.send(
				new PutCommand({
					TableName: this.registrationTableName,
					Item: record,
					ConditionExpression: "attribute_not_exists(emailNormalized)"
				})
			);
		} catch (error) {
			if (errorName(error) === "ConditionalCheckFailedException") {
				throw new DuplicatePendingRegistrationError();
			}

			throw error;
		}
	}

	async addVerificationToken(
		emailNormalized: string,
		update: {
			previousVerificationTokenHash: string;
			verificationTokenHash: string;
			lastSentAt: number;
			updatedAt: number;
			maxSendsPerWindow: number;
		}
	) {
		try {
			await this.documentClient.send(
				new UpdateCommand({
					TableName: this.registrationTableName,
					Key: { emailNormalized },
					UpdateExpression:
						[
							"SET verificationTokenHash = :tokenHash",
							"verificationTokenHashes = list_append(if_not_exists(verificationTokenHashes, :existingTokenHashes), :newTokenHashes)",
							"sendCount = sendCount + :sendIncrement",
							"lastSentAt = :lastSentAt",
							"updatedAt = :updatedAt",
						].join(", "),
					ConditionExpression:
						[
							"attribute_exists(emailNormalized)",
							"attribute_not_exists(consumedAt)",
							"sendCount < :maxSendsPerWindow",
						].join(" AND "),
					ExpressionAttributeValues: {
						":tokenHash": update.verificationTokenHash,
						":existingTokenHashes": [update.previousVerificationTokenHash],
						":newTokenHashes": [update.verificationTokenHash],
						":sendIncrement": 1,
						":lastSentAt": update.lastSentAt,
						":updatedAt": update.updatedAt,
						":maxSendsPerWindow": update.maxSendsPerWindow
					}
				})
			);
		} catch (error) {
			if (errorName(error) === "ConditionalCheckFailedException") {
				throw new VerificationResendLimitExceededError();
			}

			throw error;
		}
	}

	async findPendingByTokenHash(verificationTokenHash: string) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.registrationTableName,
				IndexName: "VerificationTokenHashIndex",
				KeyConditionExpression: "verificationTokenHash = :tokenHash",
				ExpressionAttributeValues: {
					":tokenHash": verificationTokenHash
				},
				Limit: 1
			})
		);

		const indexed =
			(response.Items?.[0] as PendingRegistrationRecord | undefined) ?? null;

		if (indexed) {
			return indexed;
		}

		return this.scanPendingByTokenHash(verificationTokenHash);
	}

	async consumeVerificationToken(args: {
		emailNormalized: string;
		verificationTokenHash: string;
		consumedAt: number;
	}) {
		try {
			await this.documentClient.send(
				new UpdateCommand({
					TableName: this.registrationTableName,
					Key: { emailNormalized: args.emailNormalized },
					UpdateExpression:
						"SET consumedAt = :consumedAt, #status = :verified, updatedAt = :consumedAt",
					ConditionExpression:
						[
							"(verificationTokenHash = :tokenHash",
							"OR (attribute_exists(verificationTokenHashes)",
							"AND contains(verificationTokenHashes, :tokenHash)))",
							"AND attribute_not_exists(consumedAt)",
						].join(" "),
					ExpressionAttributeNames: {
						"#status": "status"
					},
					ExpressionAttributeValues: {
						":tokenHash": args.verificationTokenHash,
						":consumedAt": args.consumedAt,
						":verified": "verified"
					}
				})
			);
		} catch (error) {
			if (errorName(error) === "ConditionalCheckFailedException") {
				throw new VerificationTokenAlreadyConsumedError();
			}

			throw error;
		}
	}

	async upsertStudentProfile(profile: StudentProfileRecord) {
		await this.upsertAppProfile(profile);
	}

	async upsertAppProfile(profile: AppProfileRecord) {
		await this.documentClient.send(
			new PutCommand({
				TableName: this.profileTableName,
				Item: profile
			})
		);
	}

	async hasAppProfile(emailNormalized: string) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.profileTableName,
				IndexName: "EmailIndex",
				KeyConditionExpression: "emailNormalized = :email",
				ExpressionAttributeValues: {
					":email": emailNormalized
				},
				Limit: 1
			})
		);

		return Boolean(response.Items?.length);
	}

	async getAppProfileById(profileId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.profileTableName,
				Key: { profileId }
			})
		);

		return (response.Item as AppProfileRecord | undefined) ?? null;
	}

	async getStudentProfileByEmail(emailNormalized: string) {
		const profile = await this.getProfileByEmail(emailNormalized);

		return profile?.role === "student" ? profile : null;
	}

	async getProfileByEmail(emailNormalized: string) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.profileTableName,
				IndexName: "EmailIndex",
				KeyConditionExpression: "emailNormalized = :email",
				ExpressionAttributeValues: {
					":email": emailNormalized
				},
				Limit: 1
			})
		);

		return (response.Items?.[0] as AppProfileRecord | undefined) ?? null;
	}

	async updateProfileName(args: {
		profileId: string;
		firstName: string;
		lastName: string;
		fullName: string;
		updatedAt: number;
	}) {
		await this.documentClient.send(
			new UpdateCommand({
				TableName: this.profileTableName,
				Key: { profileId: args.profileId },
				UpdateExpression:
					"SET firstName = :firstName, lastName = :lastName, fullName = :fullName, updatedAt = :updatedAt",
				ConditionExpression: "attribute_exists(profileId)",
				ExpressionAttributeValues: {
					":firstName": args.firstName,
					":lastName": args.lastName,
					":fullName": args.fullName,
					":updatedAt": args.updatedAt
				}
			})
		);
	}

	async storePendingEmailChange(args: {
		profileId: string;
		pendingEmail: string;
		pendingEmailVerificationTokenHash: string;
		pendingEmailVerificationExpiresAt: number;
		pendingEmailVerificationRequestedAt: number;
		updatedAt: number;
	}) {
		await this.documentClient.send(
			new UpdateCommand({
				TableName: this.profileTableName,
				Key: { profileId: args.profileId },
				UpdateExpression:
					[
						"SET pendingEmail = :pendingEmail",
						"pendingEmailVerificationTokenHash = :tokenHash",
						"pendingEmailVerificationExpiresAt = :expiresAt",
						"pendingEmailVerificationRequestedAt = :requestedAt",
						"updatedAt = :updatedAt"
					].join(", "),
				ConditionExpression: "attribute_exists(profileId)",
				ExpressionAttributeValues: {
					":pendingEmail": args.pendingEmail,
					":tokenHash": args.pendingEmailVerificationTokenHash,
					":expiresAt": args.pendingEmailVerificationExpiresAt,
					":requestedAt": args.pendingEmailVerificationRequestedAt,
					":updatedAt": args.updatedAt
				}
			})
		);
	}

	async findProfileByPendingEmailTokenHash(tokenHash: string) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.profileTableName,
				IndexName: "PendingEmailVerificationTokenHashIndex",
				KeyConditionExpression:
					"pendingEmailVerificationTokenHash = :tokenHash",
				ExpressionAttributeValues: {
					":tokenHash": tokenHash
				},
				Limit: 1
			})
		);

		return (response.Items?.[0] as AppProfileRecord | undefined) ?? null;
	}

	async completePendingEmailChange(args: {
		profileId: string;
		currentEmailNormalized: string;
		newEmailNormalized: string;
		verifiedAt: number;
		sessionsInvalidatedAt: number;
		sessionInvalidationExemptToken?: string;
	}) {
		const setExpressions = [
			"emailNormalized = :newEmail",
			"emailVerifiedAt = :verifiedAt",
			"sessionsInvalidatedAt = :sessionsInvalidatedAt",
			"updatedAt = :verifiedAt"
		];
		const removeExpressions = [
			"pendingEmail",
			"pendingEmailVerificationTokenHash",
			"pendingEmailVerificationExpiresAt",
			"pendingEmailVerificationRequestedAt"
		];
		const expressionAttributeValues: Record<string, unknown> = {
			":currentEmail": args.currentEmailNormalized,
			":newEmail": args.newEmailNormalized,
			":verifiedAt": args.verifiedAt,
			":sessionsInvalidatedAt": args.sessionsInvalidatedAt
		};

		if (args.sessionInvalidationExemptToken) {
			setExpressions.push("sessionInvalidationExemptToken = :exemptToken");
			expressionAttributeValues[":exemptToken"] =
				args.sessionInvalidationExemptToken;
		} else {
			removeExpressions.push("sessionInvalidationExemptToken");
		}

		await this.documentClient.send(
			new UpdateCommand({
				TableName: this.profileTableName,
				Key: { profileId: args.profileId },
				UpdateExpression: [
					`SET ${setExpressions.join(", ")}`,
					`REMOVE ${removeExpressions.join(", ")}`
				].join(" "),
				ConditionExpression:
					"emailNormalized = :currentEmail AND pendingEmail = :newEmail",
				ExpressionAttributeValues: expressionAttributeValues
			})
		);
	}

	async invalidateOtherSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
		updatedAt: number;
		sessionInvalidationExemptToken?: string;
	}) {
		const setExpressions = [
			"sessionsInvalidatedAt = :invalidatedAt",
			"updatedAt = :updatedAt"
		];
		const expressionAttributeValues: Record<string, unknown> = {
			":invalidatedAt": args.invalidatedAt,
			":updatedAt": args.updatedAt
		};

		if (args.sessionInvalidationExemptToken) {
			setExpressions.push(
				"sessionInvalidationExemptToken = :exemptToken"
			);
			expressionAttributeValues[":exemptToken"] =
				args.sessionInvalidationExemptToken;
		}

		await this.documentClient.send(
			new UpdateCommand({
				TableName: this.profileTableName,
				Key: { profileId: args.userId },
				UpdateExpression: `SET ${setExpressions.join(", ")}${
					args.sessionInvalidationExemptToken
						? ""
						: " REMOVE sessionInvalidationExemptToken"
				}`,
				ExpressionAttributeValues: expressionAttributeValues
			})
		);
	}

	async invalidateSessionsForUser(args: {
		userId: string;
		invalidatedAt: number;
	}) {
		await this.documentClient.send(
			new UpdateCommand({
				TableName: this.profileTableName,
				Key: { profileId: args.userId },
				UpdateExpression:
					"SET sessionsInvalidatedAt = :invalidatedAt, updatedAt = :updatedAt REMOVE sessionInvalidationExemptToken",
				ExpressionAttributeValues: {
					":invalidatedAt": args.invalidatedAt,
					":updatedAt": Math.floor(args.invalidatedAt / 1000)
				}
			})
		);
	}

	async listExpiredPendingRegistrations(args: { now: number; limit: number }) {
		const response = await this.documentClient.send(
			new QueryCommand({
				TableName: this.registrationTableName,
				IndexName: "StatusExpiresAtIndex",
				KeyConditionExpression: "#status = :pending AND expiresAt <= :now",
				ExpressionAttributeNames: {
					"#status": "status"
				},
				ExpressionAttributeValues: {
					":pending": "pending",
					":now": args.now
				},
				Limit: args.limit
			})
		);

		return (response.Items ?? []) as PendingRegistrationRecord[];
	}

	async deletePendingRegistration(emailNormalized: string) {
		await this.documentClient.send(
			new DeleteCommand({
				TableName: this.registrationTableName,
				Key: { emailNormalized }
			})
		);
	}

	async recordCleanupFailure(args: {
		emailNormalized: string;
		attemptedAt: number;
		error: string;
	}) {
		await this.documentClient.send(
			new UpdateCommand({
				TableName: this.registrationTableName,
				Key: { emailNormalized: args.emailNormalized },
				UpdateExpression:
					"SET cleanupAttemptedAt = :attemptedAt, cleanupError = :error",
				ExpressionAttributeValues: {
					":attemptedAt": args.attemptedAt,
					":error": args.error
				}
			})
		);
	}

	private async scanPendingByTokenHash(verificationTokenHash: string) {
		for await (const page of paginateScan(
			{ client: this.documentClient },
			{
				TableName: this.registrationTableName,
				FilterExpression:
					"attribute_exists(verificationTokenHashes) AND contains(verificationTokenHashes, :tokenHash)",
				ExpressionAttributeValues: {
					":tokenHash": verificationTokenHash
				}
			}
		)) {
			const match =
				(page.Items?.[0] as PendingRegistrationRecord | undefined) ?? null;

			if (match) {
				return match;
			}
		}

		return null;
	}
}

function errorName(error: unknown) {
	return error instanceof Error ? error.name : undefined;
}
