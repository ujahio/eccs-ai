import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	QueryCommand,
	ScanCommand,
	UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { LoginProfileRepository } from "@/features/auth/login/service";
import type {
	AppSessionInvalidator,
	PasswordResetProfileRepository
} from "@/features/auth/password-reset/service";
import type {
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
		await this.documentClient.send(
			new PutCommand({
				TableName: this.profileTableName,
				Item: profile
			})
		);
	}

	async hasStudentProfile(emailNormalized: string) {
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

	async getStudentProfileById(profileId: string) {
		const response = await this.documentClient.send(
			new GetCommand({
				TableName: this.profileTableName,
				Key: { profileId }
			})
		);

		const profile = response.Item as StudentProfileRecord | undefined;

		return profile?.role === "student" ? profile : null;
	}

	async getStudentProfileByEmail(emailNormalized: string) {
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

		const profile = response.Items?.[0] as StudentProfileRecord | undefined;

		return profile?.role === "student" ? profile : null;
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
					"SET sessionsInvalidatedAt = :invalidatedAt, updatedAt = :updatedAt",
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
		let ExclusiveStartKey: Record<string, unknown> | undefined;

		do {
			const response = await this.documentClient.send(
				new ScanCommand({
					TableName: this.registrationTableName,
					FilterExpression:
						"attribute_exists(verificationTokenHashes) AND contains(verificationTokenHashes, :tokenHash)",
					ExpressionAttributeValues: {
						":tokenHash": verificationTokenHash
					},
					ExclusiveStartKey
				})
			);
			const match =
				(response.Items?.[0] as PendingRegistrationRecord | undefined) ?? null;

			if (match) {
				return match;
			}

			ExclusiveStartKey = response.LastEvaluatedKey;
		} while (ExclusiveStartKey);

		return null;
	}
}

function errorName(error: unknown) {
	return error instanceof Error ? error.name : undefined;
}
