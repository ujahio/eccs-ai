export const registrationWorkflowTable = new sst.aws.Dynamo(
	"RegistrationWorkflowTable",
	{
		fields: {
			emailNormalized: "string",
			verificationTokenHash: "string",
			status: "string",
			expiresAt: "number"
		},
		primaryIndex: {
			hashKey: "emailNormalized"
		},
		globalIndexes: {
			VerificationTokenHashIndex: {
				hashKey: "verificationTokenHash",
				projection: "all"
			},
			StatusExpiresAtIndex: {
				hashKey: "status",
				rangeKey: "expiresAt",
				projection: "all"
			}
		},
		ttl: "ttl"
	}
);

export const userProfileTable = new sst.aws.Dynamo("UserProfileTable", {
	fields: {
		profileId: "string",
		emailNormalized: "string",
		pendingEmailVerificationTokenHash: "string",
		role: "string"
	},
	primaryIndex: {
		hashKey: "profileId"
	},
	globalIndexes: {
		EmailIndex: {
			hashKey: "emailNormalized",
			projection: "all"
		},
		RoleIndex: {
			hashKey: "role",
			projection: "all"
		},
		PendingEmailVerificationTokenHashIndex: {
			hashKey: "pendingEmailVerificationTokenHash",
			projection: "all"
		}
	}
});
