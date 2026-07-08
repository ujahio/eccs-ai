import "server-only";

import {
	QueryCommand,
	type DynamoDBDocumentClient,
	type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

export async function queryAllDynamoItems<T>(
	documentClient: DynamoDBDocumentClient,
	input: QueryCommandInput,
) {
	const records: T[] = [];
	let exclusiveStartKey: QueryCommandInput["ExclusiveStartKey"];

	do {
		const response = await documentClient.send(
			new QueryCommand({
				...input,
				...(exclusiveStartKey
					? { ExclusiveStartKey: exclusiveStartKey }
					: {}),
			}),
		);

		records.push(...((response.Items ?? []) as T[]));
		exclusiveStartKey = response.LastEvaluatedKey;
	} while (exclusiveStartKey);

	return records;
}
