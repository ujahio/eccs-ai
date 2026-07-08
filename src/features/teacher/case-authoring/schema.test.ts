import { describe, expect, it } from "vitest";
import {
	createEmptyCmeQuestion,
	deadlineAtFromDubaiDate,
	draftForEditing,
	draftForStorage,
	emptyCaseDraft,
	hasCmeQuestionContent,
	isPublishReady,
	type CaseDraft,
	validateCmeQuestions,
	validateDraftForPublish,
	validateDraftForSave,
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
	it("converts a selected deadline date to the UAE end-of-day cutoff", () => {
		expect(deadlineAtFromDubaiDate("2026-08-12")).toBe(
			Date.UTC(2026, 7, 12, 19, 59, 59, 999),
		);
		expect(deadlineAtFromDubaiDate("2026-02-31")).toBeNull();
		expect(deadlineAtFromDubaiDate("not-a-date")).toBeNull();
	});

	it("requires a Case Title before saving a draft record", () => {
		expect(validateDraftForSave(emptyCaseDraft)).toEqual({
			title: "Enter a Case Title before saving this draft.",
		});
		expect(
			validateDraftForSave({
				...emptyCaseDraft,
				title: "Acute endocrine review",
			}),
		).toEqual({});
	});

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

	it("requires a valid student deadline date before publishing", () => {
		expect(
			validateDraftForPublish({
				...validDraft(),
				deadlineDate: "2026-02-31",
			}).deadlineDate,
		).toBe("Select a valid student deadline date.");
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
			options: [
				{ id: "filled-option", text: "Prioritize serum potassium" },
				{ id: "empty-option", text: "" },
			],
			correctOptionId: "empty-option",
		};
		const draft = {
			...emptyCaseDraft,
			attachments: [
				{
					id: "attachment-1",
					name: "teaching-resource.pdf",
					size: 512,
					type: "application/pdf",
					lastModified: 1,
					previewUrl: "blob:http://localhost/preview",
					dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
				},
			],
			cmeQuestions: [blankQuestion, authoredQuestion],
		};
		const storedDraft = draftForStorage(draft);

		expect(hasCmeQuestionContent(blankQuestion)).toBe(false);
		expect(hasCmeQuestionContent(authoredQuestion)).toBe(true);
		expect(storedDraft.cmeQuestions).toEqual([
			{
				...authoredQuestion,
				options: [{ id: "filled-option", text: "Prioritize serum potassium" }],
				correctOptionId: "filled-option",
			},
		]);
		expect(storedDraft.attachments[0]).toEqual({
			id: "attachment-1",
			name: "teaching-resource.pdf",
			size: 512,
			type: "application/pdf",
			lastModified: 1,
			dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=",
		});
		expect(
			draftForEditing({ ...storedDraft, cmeQuestions: [] }).cmeQuestions,
		).toHaveLength(1);
		expect(draftForEditing(storedDraft).cmeQuestions[0].options).toHaveLength(
			2,
		);
	});
});
