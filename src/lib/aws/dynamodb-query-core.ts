import {
	type DynamoDBDocumentClient,
	paginateQuery,
	type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

export async function queryAllDynamoItems<T>(
	documentClient: DynamoDBDocumentClient,
	input: QueryCommandInput,
) {
	const records: T[] = [];

	for await (const page of paginateQuery({ client: documentClient }, input)) {
		records.push(...((page.Items ?? []) as T[]));
	}

	return records;
}
