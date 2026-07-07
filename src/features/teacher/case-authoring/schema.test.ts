import { describe, expect, it } from "vitest";
import {
	createEmptyCmeQuestion,
	draftForEditing,
	draftForStorage,
	emptyCaseDraft,
	hasCmeQuestionContent,
	isPublishReady,
	type CaseDraft,
	validateCmeQuestions,
	validateDraftForPublish,
} from "./schema";

function validQuestion(index: number) {
	const question = createEmptyCmeQuestion();

	return {
		...question,
		prompt: `Which finding best supports diagnosis ${index}?`,
		options: [
			{ id: "a", text: "First option" },
			{ id: "b", text: "Second option" },
			{ id: "c", text: "Third option" },
		],
		correctOptionId: "a",
	};
}

function validDraft(): CaseDraft {
	return {
		...emptyCaseDraft,
		title: "Acute endocrine case review",
		description:
			"A focused student-facing description of the clinical learning goals.",
		presentation:
			"Patient history, presenting symptoms, laboratory findings, and the clinical decision context are described with enough detail for learners to reason carefully.",
		modelAnswer:
			"The model answer explains the diagnostic path, key discriminating findings, management priorities, and teaching points for comparison.",
		lectureText:
			"Case Study resources summarize the core physiology, common diagnostic pitfalls, and next-step management considerations for review.",
		cmeQuestions: [validQuestion(1), validQuestion(2), validQuestion(3)],
		deadlineDate: "2026-08-12",
	};
}

describe("case authoring validation", () => {
	it("requires publish-ready drafts to include all authoring sections", () => {
		const validation = validateDraftForPublish(emptyCaseDraft);

		expect(validation).toMatchObject({
			title: "Enter a case title of at least 5 characters.",
			description: "Enter a description of at least 20 characters for students.",
			presentation:
				"Enter the case presentation using at least 100 characters.",
			modelAnswer: "Enter the model answer using at least 100 characters.",
			lectureText:
				"Enter the Case Study lecture text using at least 100 characters.",
			deadlineDate: "Select the student deadline date.",
		});
		expect(validation.cmeQuestions).toBe("Add 3 to 5 CME questions.");
	});

	it("accepts a complete draft for publish readiness", () => {
		const draft = validDraft();

		expect(validateDraftForPublish(draft)).toEqual({});
		expect(isPublishReady(draft)).toBe(true);
	});

	it("enforces CME question and option limits", () => {
		expect(validateCmeQuestions([validQuestion(1), validQuestion(2)])).toContain(
			"Add 3 to 5 CME questions.",
		);

		const question = {
			...validQuestion(1),
			options: [{ id: "a", text: "Only option" }],
			correctOptionId: "a",
		};

		expect(validateCmeQuestions([question, validQuestion(2), validQuestion(3)]))
			.toContain("Question 1 needs 2 to 5 options.");
	});

	it("uses authored content validation once three CME question tabs exist", () => {
		const errors = validateCmeQuestions([
			validQuestion(1),
			createEmptyCmeQuestion(),
			createEmptyCmeQuestion(),
		]);

		expect(errors).not.toContain("Add 3 to 5 CME questions.");
		expect(errors).toContain("Add content to at least 3 CME questions.");
	});

	it("stores only CME questions with real authored content", () => {
		const blankQuestion = createEmptyCmeQuestion();
		const authoredQuestion = {
			...createEmptyCmeQuestion(),
			prompt: "Which clinical finding should be prioritized?",
		};
		const draft = {
			...emptyCaseDraft,
			cmeQuestions: [blankQuestion, authoredQuestion],
		};

		expect(hasCmeQuestionContent(blankQuestion)).toBe(false);
		expect(hasCmeQuestionContent(authoredQuestion)).toBe(true);
		expect(draftForStorage(draft).cmeQuestions).toEqual([authoredQuestion]);
		expect(
			draftForEditing({ ...draft, cmeQuestions: [] }).cmeQuestions,
		).toHaveLength(1);
	});
});
