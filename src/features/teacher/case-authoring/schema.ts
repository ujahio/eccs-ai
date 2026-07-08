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
	dataUrl?: string;
	id: string;
	name: string;
	previewUrl?: string;
	size: number;
	type: string;
	lastModified: number;
};

export type ActivePublishedCaseSummary = {
	title: string;
	deadlineAt: number;
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
	return questions.filter(hasCmeQuestionContent).map(cmeQuestionForStorage);
}

export function draftForStorage(draft: CaseDraft): CaseDraft {
	return {
		...draft,
		attachments: draft.attachments.map(attachmentForStorage),
		cmeQuestions: savableCmeQuestions(draft.cmeQuestions),
	};
}

function attachmentForStorage(attachment: DraftAttachment): DraftAttachment {
	return {
		...(attachment.dataUrl ? { dataUrl: attachment.dataUrl } : {}),
		id: attachment.id,
		name: attachment.name,
		size: attachment.size,
		type: attachment.type,
		lastModified: attachment.lastModified,
	};
}

export function draftForEditing(draft: CaseDraft): CaseDraft {
	return {
		...draft,
		cmeQuestions:
			draft.cmeQuestions.length > 0
				? draft.cmeQuestions.map(cmeQuestionForEditing)
				: [createEmptyCmeQuestion()],
	};
}

function cmeQuestionForStorage(question: CmeQuestionDraft): CmeQuestionDraft {
	const options = question.options.filter(
		(option) => option.text.trim().length > 0,
	);

	return {
		...question,
		options,
		correctOptionId: options.some(
			(option) => option.id === question.correctOptionId,
		)
			? question.correctOptionId
			: options[0]?.id ?? null,
	};
}

function cmeQuestionForEditing(question: CmeQuestionDraft): CmeQuestionDraft {
	const options = [...question.options];

	while (options.length < 2) {
		options.push({ id: createDraftId("option"), text: "" });
	}

	return {
		...question,
		options,
		correctOptionId: options.some(
			(option) => option.id === question.correctOptionId,
		)
			? question.correctOptionId
			: options[0]?.id ?? null,
	};
}

export function caseDraftFromUnknown(value: unknown): CaseDraft {
	const input = isRecord(value) ? value : {};
	const cmeQuestions = Array.isArray(input.cmeQuestions)
		? input.cmeQuestions.map(cmeQuestionFromUnknown)
		: emptyCaseDraft.cmeQuestions;

	return draftForEditing({
		title: stringFromUnknown(input.title),
		description: stringFromUnknown(input.description),
		presentation: stringFromUnknown(input.presentation),
		modelAnswer: stringFromUnknown(input.modelAnswer),
		lectureText: stringFromUnknown(input.lectureText),
		attachments: Array.isArray(input.attachments)
			? input.attachments.flatMap((attachment) => {
					const parsed = draftAttachmentFromUnknown(attachment);

					return parsed ? [parsed] : [];
				})
			: [],
		cmeQuestions,
		deadlineDate: stringFromUnknown(input.deadlineDate),
	});
}

function draftAttachmentFromUnknown(value: unknown): DraftAttachment | null {
	if (!isRecord(value)) {
		return null;
	}

	const name = stringFromUnknown(value.name).trim();

	if (!name) {
		return null;
	}

	const dataUrl = stringFromUnknown(value.dataUrl);

	return {
		...(dataUrl ? { dataUrl } : {}),
		id: stringFromUnknown(value.id) || createDraftId("attachment"),
		name,
		size: numberFromUnknown(value.size),
		type: stringFromUnknown(value.type) || "application/pdf",
		lastModified: numberFromUnknown(value.lastModified),
	};
}

function cmeQuestionFromUnknown(value: unknown): CmeQuestionDraft {
	if (!isRecord(value)) {
		return createEmptyCmeQuestion();
	}

	const options = Array.isArray(value.options)
		? value.options.map(cmeOptionFromUnknown)
		: [];
	const normalizedOptions =
		options.length >= 2 ? options : createEmptyCmeQuestion().options;
	const correctOptionId = stringFromUnknown(value.correctOptionId);

	return {
		id: stringFromUnknown(value.id) || createDraftId("question"),
		prompt: stringFromUnknown(value.prompt),
		options: normalizedOptions,
		correctOptionId: normalizedOptions.some(
			(option) => option.id === correctOptionId,
		)
			? correctOptionId
			: normalizedOptions[0]?.id ?? null,
	};
}

function cmeOptionFromUnknown(value: unknown): CmeOptionDraft {
	if (!isRecord(value)) {
		return { id: createDraftId("option"), text: "" };
	}

	return {
		id: stringFromUnknown(value.id) || createDraftId("option"),
		text: stringFromUnknown(value.text),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stringFromUnknown(value: unknown) {
	return typeof value === "string" ? value : "";
}

function numberFromUnknown(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
