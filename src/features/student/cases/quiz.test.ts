import { describe, expect, it } from "vitest";
import { quizOptionLabel, shuffleStudentCaseQuizQuestions } from "./quiz";
import type { StudentCaseQuizQuestion } from "./student-case";

const questions: StudentCaseQuizQuestion[] = [
	{
		questionId: "question-1",
		prompt: "First prompt",
		options: [
			{ optionId: "q1-a", text: "First option" },
			{ optionId: "q1-b", text: "Second option" },
		],
	},
	{
		questionId: "question-2",
		prompt: "Second prompt",
		options: [
			{ optionId: "q2-a", text: "Third option" },
			{ optionId: "q2-b", text: "Fourth option" },
		],
	},
	{
		questionId: "question-3",
		prompt: "Third prompt",
		options: [
			{ optionId: "q3-a", text: "Fifth option" },
			{ optionId: "q3-b", text: "Sixth option" },
		],
	},
];

describe("student case quiz helpers", () => {
	it("shuffles question order while preserving authored option order", () => {
		const shuffled = shuffleStudentCaseQuizQuestions(questions, "case-1");

		expect(shuffled.map((question) => question.questionId)).not.toEqual(
			questions.map((question) => question.questionId),
		);
		expect(shuffled.map((question) => question.questionId).sort()).toEqual([
			"question-1",
			"question-2",
			"question-3",
		]);
		const firstQuestion = shuffled.find(
			(question) => question.questionId === "question-1",
		);

		expect(firstQuestion?.options).toEqual(questions[0]?.options);
		expect(questions.map((question) => question.questionId)).toEqual([
			"question-1",
			"question-2",
			"question-3",
		]);
	});

	it("labels options with authored ordering letters", () => {
		expect(quizOptionLabel(0)).toBe("A");
		expect(quizOptionLabel(1)).toBe("B");
		expect(quizOptionLabel(4)).toBe("E");
	});
});
