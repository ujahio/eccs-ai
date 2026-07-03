export function toFormErrors<TField extends string>(
	fieldErrors: Partial<Record<TField, string | undefined>>
): Partial<Record<TField, string[]>> {
	return Object.fromEntries(
		Object.entries(fieldErrors)
			.filter((entry): entry is [TField, string] => Boolean(entry[1]))
			.map(([field, error]) => [field, [error]])
	) as Partial<Record<TField, string[]>>;
}
