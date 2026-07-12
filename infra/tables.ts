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

export const teacherCaseTable = new sst.aws.Dynamo("TeacherCaseTable", {
	fields: {
		caseId: "string",
		lifecycle: "string",
		deadlineAt: "number",
		archivedAt: "number"
	},
	primaryIndex: {
		hashKey: "caseId"
	},
	globalIndexes: {
		LifecycleDeadlineIndex: {
			hashKey: "lifecycle",
			rangeKey: "deadlineAt",
			projection: "all"
		},
		LifecycleArchivedIndex: {
			hashKey: "lifecycle",
			rangeKey: "archivedAt",
			projection: "all"
		}
	}
});

export const studentCertificateTable = new sst.aws.Dynamo(
	"StudentCertificateTable",
	{
		fields: {
			certificateId: "string",
			studentProfileId: "string",
			completedAt: "number"
		},
		primaryIndex: {
			hashKey: "certificateId"
		},
		globalIndexes: {
			StudentCompletedAtIndex: {
				hashKey: "studentProfileId",
				rangeKey: "completedAt",
				projection: "all"
			}
		}
	}
);

export const studentCaseCompletionTable = new sst.aws.Dynamo(
	"StudentCaseCompletionTable",
	{
		fields: {
			completionId: "string",
			caseId: "string",
			studentProfileId: "string",
			completedAt: "number"
		},
		primaryIndex: {
			hashKey: "completionId"
		},
		globalIndexes: {
			CaseCompletedAtIndex: {
				hashKey: "caseId",
				rangeKey: "completedAt",
				projection: "all"
			},
			StudentCompletedAtIndex: {
				hashKey: "studentProfileId",
				rangeKey: "completedAt",
				projection: "all"
			}
		}
	}
);

export const studentQuizAttemptTable = new sst.aws.Dynamo(
	"StudentQuizAttemptTable",
	{
		fields: {
			attemptId: "string"
		},
		primaryIndex: {
			hashKey: "attemptId"
		}
	}
);
