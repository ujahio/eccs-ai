export function formatDubaiDate(epochMilliseconds: number) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Asia/Dubai",
	}).format(new Date(epochMilliseconds));
}
