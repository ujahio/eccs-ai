export function awsClientConfig() {
	const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

	return region ? { region } : {};
}
