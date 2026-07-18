const tables = await import("./tables");

export const activeCaseArchiveScheduleGroupName = "default";
export const activeCaseArchiveScheduleName = `${$app.name}-${$app.stage}-active-case-archive`;
export const activeCaseArchiveScheduleArn =
	$interpolate`arn:${aws.getPartitionOutput({}).partition}:scheduler:${aws.getRegionOutput({}).region}:${aws.getCallerIdentityOutput({}).accountId}:schedule/${activeCaseArchiveScheduleGroupName}/${activeCaseArchiveScheduleName}`;

export const archiveFunction = new sst.aws.Function(
	"ActiveCaseArchiveFunction",
	{
		dev: false,
		handler: "src/features/teacher/cases/archive-active-case-job.handler",
		link: [tables.teacherCaseTable],
	},
);

const archiveSchedulerRole = new aws.iam.Role("ActiveCaseArchiveSchedulerRole", {
	assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
		statements: [
			{
				actions: ["sts:AssumeRole"],
				principals: [
					{
						type: "Service",
						identifiers: ["scheduler.amazonaws.com"],
					},
				],
			},
		],
	}).json,
});

new aws.iam.RolePolicy("ActiveCaseArchiveSchedulerRolePolicy", {
	role: archiveSchedulerRole.name,
	policy: aws.iam.getPolicyDocumentOutput({
		statements: [
			{
				actions: ["lambda:InvokeFunction"],
				resources: [archiveFunction.arn],
			},
		],
	}).json,
});

export const archiveSchedulerRoleArn = archiveSchedulerRole.arn;

export const activeCaseArchiveSchedule = new sst.Linkable(
	"ActiveCaseArchiveSchedule",
	{
		properties: {
			groupName: activeCaseArchiveScheduleGroupName,
			roleArn: archiveSchedulerRoleArn,
			scheduleName: activeCaseArchiveScheduleName,
			targetArn: archiveFunction.arn,
		},
	},
);
