export type CognitoUserGroupArgs = {
	userPoolId: $util.Input<string>;
	name: $util.Input<string>;
	description?: $util.Input<string>;
	precedence?: $util.Input<number>;
	roleArn?: $util.Input<string>;
};

export class CognitoUserGroup extends $util.ComponentResource {
	public readonly id: $util.Output<string>;
	public readonly name: $util.Output<string>;

	constructor(
		name: string,
		args: CognitoUserGroupArgs,
		opts?: $util.ComponentResourceOptions
	) {
		super("eccs:aws:CognitoUserGroup", name, {}, opts);

		const group = new aws.cognito.UserGroup(
			name,
			{
				userPoolId: args.userPoolId,
				name: args.name,
				description: args.description,
				precedence: args.precedence,
				roleArn: args.roleArn
			},
			{
				parent: this,
				aliases: [{ parent: $util.rootStackResource }]
			}
		);

		this.id = group.id;
		this.name = group.name;

		this.registerOutputs({
			id: this.id,
			name: this.name
		});
	}
}
