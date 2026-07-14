import { describe, expect, it } from "vitest";
import {
	StudentCaseFeedbackValidationError,
	type StudentCaseFeedbackInput,
	validateStudentCaseFeedbackInput,
} from "./feedback";

describe("student case feedback validation", () => {
	it("accepts provided 1-5 ratings and trims written feedback", () => {
		expect(
			validateStudentCaseFeedbackInput({
				futureSuggestions: "  Add more hematology cases.  ",
				ratings: {
					knowledge: 5,
					patientCare: 4,
				},
			}),
		).toEqual({
			futureSuggestions: "Add more hematology cases.",
			ratings: {
				knowledge: 5,
				patientCare: 4,
			},
		});
	});

	it("accepts written feedback without ratings", () => {
		expect(
			validateStudentCaseFeedbackInput({
				futureSuggestions: "  Add future microbiology cases.  ",
				ratings: {},
			}),
		).toEqual({
			futureSuggestions: "Add future microbiology cases.",
		});
	});

	it("omits empty written feedback and missing ratings", () => {
		expect(
			validateStudentCaseFeedbackInput({
				futureSuggestions: "   ",
				ratings: {
					knowledge: 1,
				},
			}),
		).toEqual({
			ratings: {
				knowledge: 1,
			},
		});
	});

	it("normalizes blank feedback to no saved values", () => {
		expect(
			validateStudentCaseFeedbackInput({
				futureSuggestions: "   ",
				ratings: {},
			}),
		).toEqual({});
	});

	it("rejects out-of-range and non-integer ratings", () => {
		const invalidRatings = [
			{ knowledge: 0 },
			{ knowledge: 6 },
			{ knowledge: 3.5 },
		] satisfies StudentCaseFeedbackInput["ratings"][];

		for (const ratingOverride of invalidRatings) {
			expect(() =>
					validateStudentCaseFeedbackInput({
						futureSuggestions: "",
						ratings: feedbackRatingsFixture(ratingOverride),
					}),
				).toThrow(StudentCaseFeedbackValidationError);
			}
	});

	it("rejects written feedback over 2,000 characters", () => {
		expect(() =>
			validateStudentCaseFeedbackInput({
				futureSuggestions: "x".repeat(2_001),
				ratings: feedbackRatingsFixture(),
			}),
		).toThrow("Keep your written feedback to 2,000 characters or fewer.");
	});
});

function feedbackRatingsFixture(
	overrides: StudentCaseFeedbackInput["ratings"] = {},
) {
	return {
		knowledge: 5,
		interpretation: 4,
		patientCare: 5,
		userExperience: 4,
		...overrides,
	};
}
