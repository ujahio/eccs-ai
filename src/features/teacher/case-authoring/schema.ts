export const caseAuthoringSections = [
	"title",
	"presentation",
	"modelAnswer",
	"resources",
	"cme",
	"review",
] as const;

export type CaseAuthoringSection = (typeof caseAuthoringSections)[number];

export type DraftAttachment = {
	id: string;
	name: string;
	size: number;
	type: string;
	lastModified: number;
};

export type CmeOptionDraft = {
	id: string;
	text: string;
};

export type CmeQuestionDraft = {
	id: string;
	prompt: string;
	options: CmeOptionDraft[];
	correctOptionId: string | null;
};

export type CaseDraft = {
	title: string;
	description: string;
	presentation: string;
	modelAnswer: string;
	lectureText: string;
	attachments: DraftAttachment[];
	cmeQuestions: CmeQuestionDraft[];
	deadlineDate: string;
};

export type CaseDraftValidation = {
	title?: string;
	description?: string;
	presentation?: string;
	modelAnswer?: string;
	lectureText?: string;
	attachments?: string;
	cmeQuestions?: string;
	deadlineDate?: string;
};

export const emptyCaseDraft: CaseDraft = {
	title: "",
	description: "",
	presentation: "",
	modelAnswer: "",
	lectureText: "",
	attachments: [],
	cmeQuestions: [createEmptyCmeQuestion()],
	deadlineDate: "",
};

export function createEmptyCmeQuestion(): CmeQuestionDraft {
	const firstOptionId = createDraftId("option");

	return {
		id: createDraftId("question"),
		prompt: "",
		options: [
			{ id: firstOptionId, text: "" },
			{ id: createDraftId("option"), text: "" },
		],
		correctOptionId: firstOptionId,
	};
}

export function createDraftId(prefix: string) {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function hasCmeQuestionContent(question: CmeQuestionDraft) {
	return (
		question.prompt.trim().length > 0 ||
		question.options.some((option) => option.text.trim().length > 0)
	);
}

export function savableCmeQuestions(questions: CmeQuestionDraft[]) {
	return questions.filter(hasCmeQuestionContent);
}

export function draftForStorage(draft: CaseDraft): CaseDraft {
	return {
		...draft,
		cmeQuestions: savableCmeQuestions(draft.cmeQuestions),
	};
}

export function draftForEditing(draft: CaseDraft): CaseDraft {
	return {
		...draft,
		cmeQuestions:
			draft.cmeQuestions.length > 0
				? draft.cmeQuestions
				: [createEmptyCmeQuestion()],
	};
}

export function validateDraftForPublish(
	draft: CaseDraft,
): CaseDraftValidation {
	const validation: CaseDraftValidation = {};

	if (draft.title.trim().length < 5) {
		validation.title = "Enter a case title of at least 5 characters.";
	}

	if (draft.description.trim().length < 20) {
		validation.description =
			"Enter a description of at least 20 characters for students.";
	}

	if (draft.presentation.trim().length < 100) {
		validation.presentation =
			"Enter the case presentation using at least 100 characters.";
	}

	if (draft.modelAnswer.trim().length < 100) {
		validation.modelAnswer =
			"Enter the model answer using at least 100 characters.";
	}

	if (draft.lectureText.trim().length < 100) {
		validation.lectureText =
			"Enter the Case Study lecture text using at least 100 characters.";
	}

	const cmeErrors = validateCmeQuestions(draft.cmeQuestions);
	if (cmeErrors.length > 0) {
		validation.cmeQuestions = cmeErrors[0];
	}

	if (!draft.deadlineDate) {
		validation.deadlineDate = "Select the student deadline date.";
	}

	return validation;
}

export function validateCmeQuestions(questions: CmeQuestionDraft[]) {
	const errors: string[] = [];
	const authoredQuestions = questions
		.map((question, index) => ({ index, question }))
		.filter(({ question }) => hasCmeQuestionContent(question));

	if (questions.length < 3 || questions.length > 5) {
		errors.push("Add 3 to 5 CME questions.");
	} else if (authoredQuestions.length < 3) {
		errors.push("Add content to at least 3 CME questions.");
	}

	authoredQuestions.forEach(({ index, question }) => {
		const questionNumber = index + 1;

		if (question.prompt.trim().length < 10) {
			errors.push(`Question ${questionNumber} needs a clear prompt.`);
		}

		if (question.options.length < 2 || question.options.length > 5) {
			errors.push(`Question ${questionNumber} needs 2 to 5 options.`);
		}

		question.options.forEach((option, optionIndex) => {
			if (option.text.trim().length === 0) {
				errors.push(
					`Question ${questionNumber}, option ${optionIndex + 1} needs text.`,
				);
			}
		});

		if (
			question.correctOptionId === null ||
			!question.options.some((option) => option.id === question.correctOptionId)
		) {
			errors.push(`Question ${questionNumber} needs one correct answer.`);
		}
	});

	return errors;
}

export function isPublishReady(draft: CaseDraft) {
	return Object.keys(validateDraftForPublish(draft)).length === 0;
}
