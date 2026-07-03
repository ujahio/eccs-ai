export const userPool = new sst.aws.CognitoUserPool("AuthUserPool", {
	usernames: ["email"],
	transform: {
		userPool(args) {
			args.adminCreateUserConfig = {
				allowAdminCreateUserOnly: true,
			};
			args.passwordPolicy = {
				minimumLength: 8,
				requireLowercase: true,
				requireNumbers: true,
				requireSymbols: false,
				requireUppercase: false,
				temporaryPasswordValidityDays: 1,
			};
		},
	},
});

export const userPoolClient = userPool.addClient("AuthUserPoolClient", {
	transform: {
		client(args) {
			args.explicitAuthFlows = [
				"ALLOW_USER_PASSWORD_AUTH",
				"ALLOW_REFRESH_TOKEN_AUTH",
			];
			args.generateSecret = false;
			args.preventUserExistenceErrors = "ENABLED";
		},
	},
});

export const studentGroup = new aws.cognito.UserGroup("StudentGroup", {
	userPoolId: userPool.id,
	name: "student",
	description: "Student learner accounts",
});

export const teacherGroup = new aws.cognito.UserGroup("TeacherGroup", {
	userPoolId: userPool.id,
	name: "teacher",
	description: "Teacher educator accounts",
});
