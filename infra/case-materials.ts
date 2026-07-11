export const caseMaterialBucket = new sst.aws.Bucket("CaseMaterialBucket", {
	versioning: true,
	transform: {
		policy: (args) => {
			args.policy = sst.aws.iamEdit(args.policy, (policy) => {
				policy.Statement.push({
					Sid: "DenyInsecureTransport",
					Effect: "Deny",
					Principal: "*",
					Action: "s3:*",
					Resource: [
						$interpolate`arn:aws:s3:::${args.bucket}`,
						$interpolate`arn:aws:s3:::${args.bucket}/*`,
					],
					Condition: {
						Bool: {
							"aws:SecureTransport": "false",
						},
					},
				});
			});
		},
	},
});
