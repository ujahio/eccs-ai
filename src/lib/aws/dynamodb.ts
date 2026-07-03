import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { LoginProfileRepository } from "@/features/auth/login/service";
import type {
	PendingRegistrationRecord,
	RegistrationWorkflowRepository,
	StudentProfileRecord
} from "@/features/auth/registration/repository";
import {
	DuplicatePendingRegistrationError,
	VerificationTokenAlreadyConsumedError
} from "@/features/auth/registration/repository";

export class DynamoAuthRepository
	implements RegistrationWorkflowRepository, LoginProfileRepository
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
				Key: { emailNormalized }
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

	async replaceVerificationToken(
		emailNormalized: string,
		update: Pick<
			PendingRegistrationRecord,
			| "verificationTokenHash"
			| "expiresAt"
			| "sendCount"
			| "lastSentAt"
			| "rateLimitWindowStartedAt"
			| "updatedAt"
			| "ttl"
		>
	) {
		await this.documentClient.send(
			new UpdateCommand({
				TableName: this.registrationTableName,
				Key: { emailNormalized },
				UpdateExpression:
					"SET verificationTokenHash = :tokenHash, expiresAt = :expiresAt, sendCount = :sendCount, lastSentAt = :lastSentAt, rateLimitWindowStartedAt = :windowStartedAt, updatedAt = :updatedAt, #ttl = :ttl",
				ConditionExpression:
					"attribute_exists(emailNormalized) AND attribute_not_exists(consumedAt)",
				ExpressionAttributeNames: {
					"#ttl": "ttl"
				},
				ExpressionAttributeValues: {
					":tokenHash": update.verificationTokenHash,
					":expiresAt": update.expiresAt,
					":sendCount": update.sendCount,
					":lastSentAt": update.lastSentAt,
					":windowStartedAt": update.rateLimitWindowStartedAt,
					":updatedAt": update.updatedAt,
					":ttl": update.ttl
				}
			})
		);
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

		return (
			(response.Items?.[0] as PendingRegistrationRecord | undefined) ?? null
		);
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
						"verificationTokenHash = :tokenHash AND attribute_not_exists(consumedAt)",
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
}

function errorName(error: unknown) {
	return error instanceof Error ? error.name : undefined;
}
