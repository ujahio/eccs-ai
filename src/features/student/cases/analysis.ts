export const minimumAnalysisWordCount = 150;
export const maximumAnalysisWordCount = 700;

export type AnalysisWordCountValidation =
	| { valid: true; wordCount: number }
	| { message: string; valid: false; wordCount: number };

export function countAnalysisWords(value: string) {
	const words = value.trim().match(/\S+/g);

	return words?.length ?? 0;
}

export function validateAnalysisWordCount(
	value: string,
): AnalysisWordCountValidation {
	const wordCount = countAnalysisWords(value);

	if (wordCount < minimumAnalysisWordCount) {
		return {
			valid: false,
			wordCount,
			message: `Write at least ${minimumAnalysisWordCount} words before continuing.`,
		};
	}

	if (wordCount > maximumAnalysisWordCount) {
		return {
			valid: false,
			wordCount,
			message: `Keep your analysis to ${maximumAnalysisWordCount} words or fewer.`,
		};
	}

	return { valid: true, wordCount };
}
