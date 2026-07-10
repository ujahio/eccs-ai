import { describe, expect, it } from "vitest";
import {
	countAnalysisWords,
	maximumAnalysisWordCount,
	minimumAnalysisWordCount,
	validateAnalysisWordCount,
} from "./analysis";

function words(count: number) {
	return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

describe("student case analysis validation", () => {
	it("counts non-empty words", () => {
		expect(countAnalysisWords("  Clinical reasoning\nwith spacing.  ")).toBe(4);
	});

	it("rejects analysis below the minimum", () => {
		const result = validateAnalysisWordCount(words(minimumAnalysisWordCount - 1));

		expect(result).toEqual({
			valid: false,
			wordCount: minimumAnalysisWordCount - 1,
			message: `Write at least ${minimumAnalysisWordCount} words before continuing.`,
		});
	});

	it("rejects analysis above the maximum", () => {
		const result = validateAnalysisWordCount(words(maximumAnalysisWordCount + 1));

		expect(result).toEqual({
			valid: false,
			wordCount: maximumAnalysisWordCount + 1,
			message: `Keep your analysis to ${maximumAnalysisWordCount} words or fewer.`,
		});
	});

	it("accepts analysis inside the required range", () => {
		const result = validateAnalysisWordCount(words(minimumAnalysisWordCount));

		expect(result).toEqual({
			valid: true,
			wordCount: minimumAnalysisWordCount,
		});
	});
});
