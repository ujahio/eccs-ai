import { Button } from "@/components/ui/button";
import {
	createDraftId,
	hasCmeQuestionContent,
	type CmeQuestionDraft,
	savableCmeQuestions,
	validateCmeQuestions,
} from "../schema";
import { Field, SectionHeading } from "../shared";

export function CmeSection({
	activeQuestionIndex,
	addQuestion,
	questions,
	removeQuestion,
	setActiveQuestionIndex,
	updateQuestion,
}: {
	activeQuestionIndex: number;
	addQuestion: () => void;
	questions: CmeQuestionDraft[];
	removeQuestion: () => void;
	setActiveQuestionIndex: (index: number) => void;
	updateQuestion: (question: CmeQuestionDraft) => void;
}) {
	const question = questions[activeQuestionIndex] ?? questions[0];
	const errors = validateCmeQuestions(questions);
	const authoredQuestionCount = savableCmeQuestions(questions).length;

	function updateOption(optionId: string, text: string) {
		updateQuestion({
			...question,
			options: question.options.map((option) =>
				option.id === optionId ? { ...option, text } : option,
			),
		});
	}

	function addOption() {
		if (question.options.length >= 5) {
			return;
		}

		updateQuestion({
			...question,
			options: [...question.options, { id: createDraftId("option"), text: "" }],
		});
	}

	function removeOption(optionId: string) {
		if (question.options.length <= 2) {
			return;
		}

		const options = question.options.filter((option) => option.id !== optionId);
		updateQuestion({
			...question,
			options,
			correctOptionId:
				question.correctOptionId === optionId
					? options[0]?.id ?? null
					: question.correctOptionId,
		});
	}

	return (
		<div data-testid="teacher-case-cme-section">
			<SectionHeading
				description="Add one CME question at a time. Each question needs 2 to 5 options and one correct answer."
				title="CME Questions"
			/>
			<div className="mx-auto mt-6 max-w-3xl">
				<div className="mb-4 flex flex-col gap-3 border-b border-border-gray pb-4 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm font-semibold text-primary-text">
						{authoredQuestionCount}{" "}
						{authoredQuestionCount === 1 ? "question" : "questions"} started,
						5 max
					</p>
					<div
						aria-label="CME question selector"
						className="flex flex-wrap gap-2"
					>
						{questions.map((item, index) => {
							const hasContent = hasCmeQuestionContent(item);

							return (
								<button
									aria-label={`Question ${index + 1}`}
									className={[
										"flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal",
										index === activeQuestionIndex
											? "border-primary-action bg-primary-action text-white"
											: hasContent
												? "border-success-mint bg-success-soft text-primary-text"
												: "border-border-gray bg-white text-muted-gray",
									].join(" ")}
									key={item.id}
									onClick={() => setActiveQuestionIndex(index)}
									title={
										hasContent
											? `Question ${index + 1} has content`
											: `Question ${index + 1} is empty`
									}
									type="button"
								>
									{index + 1}
								</button>
							);
						})}
					</div>
				</div>

				<div className="border border-border-gray bg-white p-5 sm:p-6">
					<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p
								className="text-sm text-muted-gray"
								data-testid="teacher-case-cme-counter"
							>
								Question {activeQuestionIndex + 1}
							</p>
							<p className="sr-only">
								Question {activeQuestionIndex + 1} of {questions.length}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								className="gap-2"
								data-testid="teacher-case-add-cme-option"
								disabled={question.options.length >= 5}
								onClick={addOption}
								size="sm"
								variant="secondary"
							>
								<PlusIcon />
								Add A New Option
							</Button>
							<button
								aria-label="Remove question"
								className="flex h-9 w-9 items-center justify-center border border-border-gray bg-white text-primary-action transition hover:border-error-red hover:text-error-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:pointer-events-none disabled:opacity-40"
								data-testid="teacher-case-remove-cme-question"
								disabled={questions.length <= 1}
								onClick={removeQuestion}
								type="button"
							>
								<TrashIcon />
							</button>
						</div>
					</div>
					<Field
						hideLabel
						label="Question Prompt"
						testId="teacher-case-cme-prompt"
					>
						<textarea
							className="min-h-12 w-full resize-y rounded-none border border-border-gray bg-white p-3 text-sm leading-6 outline-none focus:border-brand-teal"
							data-testid="teacher-case-cme-prompt"
							id="teacher-case-cme-prompt"
							onChange={(event) =>
								updateQuestion({ ...question, prompt: event.target.value })
							}
							value={question.prompt}
						/>
					</Field>
					<p className="mt-5 text-sm text-muted-gray">
						Options for question {activeQuestionIndex + 1}
					</p>
					<div className="mt-2 space-y-3">
						{question.options.map((option, index) => (
							<div
								className="grid grid-cols-[40px_minmax(0,1fr)] gap-3"
								key={option.id}
							>
								<label
									className={[
										"flex h-10 w-10 cursor-pointer items-center justify-center border transition",
										question.correctOptionId === option.id
											? "border-primary-action bg-primary-action text-white"
											: "border-border-gray bg-white text-muted-gray hover:border-brand-teal",
									].join(" ")}
								>
									<span className="sr-only">
										Mark option {optionLabel(index)} correct
									</span>
									<input
										checked={question.correctOptionId === option.id}
										className="sr-only"
										onChange={() =>
											updateQuestion({
												...question,
												correctOptionId: option.id,
											})
										}
										type="radio"
									/>
									{question.correctOptionId === option.id ? (
										<CheckIcon />
									) : (
										<span className="h-4 w-4 rounded-full border border-current" />
									)}
								</label>
								<div className="grid grid-cols-[minmax(0,1fr)_40px]">
									<input
										className="h-10 w-full border border-border-gray bg-white px-4 text-sm outline-none focus:border-brand-teal"
										data-testid={`teacher-case-cme-option-${index}`}
										onChange={(event) =>
											updateOption(option.id, event.target.value)
										}
										placeholder={`Option ${optionLabel(index)}`}
										value={option.text}
									/>
									<button
										aria-label={`Remove option ${optionLabel(index)}`}
										className="flex h-10 w-10 items-center justify-center border-y border-r border-border-gray bg-white text-muted-gray transition hover:text-error-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:pointer-events-none disabled:opacity-40"
										disabled={question.options.length <= 2}
										onClick={() => removeOption(option.id)}
										type="button"
									>
										<MinusCircleIcon />
									</button>
								</div>
							</div>
						))}
					</div>
				</div>

				<button
					className="mt-2 flex h-11 w-full items-center justify-between border border-border-gray bg-white px-5 text-left text-sm font-semibold uppercase text-primary-action transition hover:border-primary-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:pointer-events-none disabled:opacity-40"
					data-testid="teacher-case-add-cme-question"
					disabled={questions.length >= 5}
					onClick={addQuestion}
					type="button"
				>
					Add Question
					<PlusIcon />
				</button>
			</div>

			{errors.length > 0 ? (
				<p
					className="mx-auto mt-4 max-w-3xl text-sm font-semibold text-error-red"
					data-testid="teacher-case-cme-validation"
				>
					{errors[0]}
				</p>
			) : null}
		</div>
	);
}

function optionLabel(index: number) {
	return String.fromCharCode(65 + index);
}

function CheckIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-4 w-4"
			fill="none"
			focusable="false"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2.4"
			viewBox="0 0 24 24"
		>
			<path d="M5 13l4 4L19 7" />
		</svg>
	);
}

function MinusCircleIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-4 w-4"
			fill="none"
			focusable="false"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M8 12h8" />
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-4 w-4 shrink-0"
			fill="none"
			focusable="false"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
		>
			<path d="M12 5v14" />
			<path d="M5 12h14" />
		</svg>
	);
}

function TrashIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-4 w-4 shrink-0"
			fill="none"
			focusable="false"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
		>
			<path d="M3 6h18" />
			<path d="M8 6V4h8v2" />
			<path d="M6 6l1 14h10l1-14" />
			<path d="M10 11v5" />
			<path d="M14 11v5" />
		</svg>
	);
}
