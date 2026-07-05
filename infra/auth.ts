import { resendApiKey } from "./secrets";

const account = aws.getCallerIdentityOutput({});
const customSenderKey = new aws.kms.Key("CognitoCustomSenderKey", {
	description: "Encrypts Cognito custom sender password reset codes",
	enableKeyRotation: true,
	policy: aws.iam.getPolicyDocumentOutput({
		statements: [
			{
				sid: "AllowAccountKeyAdministration",
				actions: ["kms:*"],
				resources: ["*"],
				principals: [
					{
						type: "AWS",
						identifiers: [
							account.accountId.apply(
								(id) => `arn:aws:iam::${id}:root`
							)
						]
					}
				]
			},
			{
				sid: "AllowCognitoToEncryptSenderCodes",
				actions: [
					"kms:DescribeKey",
					"kms:Encrypt",
					"kms:GenerateDataKey"
				],
				resources: ["*"],
				principals: [
					{
						type: "Service",
						identifiers: ["cognito-idp.amazonaws.com"]
					}
				]
			}
		]
	}).json
});

export const customSenderKeyAlias = new aws.kms.Alias(
	"CognitoCustomSenderKeyAlias",
	{
		name: `alias/${$app.name}/${$app.stage}/cognito-custom-sender`,
		targetKeyId: customSenderKey.keyId
	}
);

export const userPool = new sst.aws.CognitoUserPool("AuthUserPool", {
	usernames: ["email"],
	triggers: {
		kmsKey: customSenderKey.arn,
		customEmailSender: {
			handler: "src/functions/auth/custom-email-sender.handler",
			environment: {
				COGNITO_CUSTOM_SENDER_KEY_ARN: customSenderKey.arn,
				ECCS_EMAIL_SENDER:
					process.env.ECCS_EMAIL_SENDER ??
					"no-reply@contact.eccs-online.xyz",
				NEXT_PUBLIC_APP_URL:
					process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
			},
			link: [resendApiKey],
			nodejs: {
				install: {
					"@aws-crypto/client-node": "5.0.0"
				}
			},
			permissions: [
				{
					actions: ["kms:Decrypt"],
					resources: [customSenderKey.arn]
				}
			]
		}
	},
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
