export const studentCaseFeedbackRatingQuestions = [
	{
		id: "knowledge",
		question:
			"The case subject represents new knowledge or strengthens existing knowledge.",
	},
	{
		id: "interpretation",
		question:
			"The case subject would better help or strengthen my interpretation of clinical laboratory results.",
	},
	{
		id: "patientCare",
		question:
			"The case would help impact or strengthen my care of patients in the subject area.",
	},
	{
		id: "userExperience",
		question: "My user experience of the app was good.",
	},
] as const;

export const studentCaseFeedbackSuggestionsQuestion =
	"Are there any suggestions of future case subject areas, and or improvement for the app?";

export type StudentCaseFeedbackRatingKey =
	(typeof studentCaseFeedbackRatingQuestions)[number]["id"];
export type StudentCaseFeedbackRating = 1 | 2 | 3 | 4 | 5;

export type StudentCaseFeedbackRatings = Record<
	StudentCaseFeedbackRatingKey,
	StudentCaseFeedbackRating
>;

export type StudentCaseFeedback = {
	futureSuggestions?: string;
	ratings: StudentCaseFeedbackRatings;
	submittedAt: number;
};

export type StudentCaseFeedbackInput = {
	futureSuggestions: string;
	ratings: Partial<Record<StudentCaseFeedbackRatingKey, number>>;
};

export class StudentCaseFeedbackValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "StudentCaseFeedbackValidationError";
	}
}

export function validateStudentCaseFeedbackInput(
	input: StudentCaseFeedbackInput,
) {
	const ratings = {} as StudentCaseFeedbackRatings;

	for (const question of studentCaseFeedbackRatingQuestions) {
		const rating = input.ratings[question.id];

		if (!isStudentCaseFeedbackRating(rating)) {
			throw new StudentCaseFeedbackValidationError(
				"Choose a 1-5 rating for each feedback question.",
			);
		}

		ratings[question.id] = rating;
	}

	const futureSuggestions = input.futureSuggestions.trim();

	if (futureSuggestions.length > 2_000) {
		throw new StudentCaseFeedbackValidationError(
			"Keep your written feedback to 2,000 characters or fewer.",
		);
	}

	return {
		...(futureSuggestions ? { futureSuggestions } : {}),
		ratings,
	};
}

function isStudentCaseFeedbackRating(
	rating: unknown,
): rating is StudentCaseFeedbackRating {
	return (
		typeof rating === "number" &&
		Number.isInteger(rating) &&
		rating >= 1 &&
		rating <= 5
	);
}
