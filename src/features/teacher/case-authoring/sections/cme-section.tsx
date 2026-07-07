import { Button } from "@/components/ui/button";
import {
	createDraftId,
	type CmeQuestionDraft,
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
			<div className="mb-5 flex flex-col gap-3 border-b border-border-gray pb-4 sm:flex-row sm:items-center sm:justify-between">
				<p
					className="text-sm font-semibold"
					data-testid="teacher-case-cme-counter"
				>
					Question {activeQuestionIndex + 1} of {questions.length}
				</p>
				<div className="flex flex-wrap gap-2">
					{questions.map((item, index) => (
						<button
							className={[
								"h-9 w-9 rounded-full border text-sm font-semibold",
								index === activeQuestionIndex
									? "border-brand-teal bg-success-soft text-primary-text"
									: "border-border-gray bg-white",
							].join(" ")}
							key={item.id}
							onClick={() => setActiveQuestionIndex(index)}
							type="button"
						>
							{index + 1}
						</button>
					))}
				</div>
			</div>
			<Field label="Question prompt" testId="teacher-case-cme-prompt">
				<textarea
					className="min-h-28 w-full resize-y rounded-[3px] border border-border-gray bg-white p-3 text-sm leading-6 outline-none focus:border-brand-teal"
					data-testid="teacher-case-cme-prompt"
					id="teacher-case-cme-prompt"
					onChange={(event) =>
						updateQuestion({ ...question, prompt: event.target.value })
					}
					value={question.prompt}
				/>
			</Field>
			<div className="mt-5 space-y-3">
				{question.options.map((option, index) => (
					<div
						className="grid gap-3 rounded border border-border-gray bg-app-canvas p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
						key={option.id}
					>
						<input
							aria-label={`Mark option ${index + 1} correct`}
							checked={question.correctOptionId === option.id}
							className="mt-3 h-4 w-4"
							onChange={() =>
								updateQuestion({ ...question, correctOptionId: option.id })
							}
							type="radio"
						/>
						<input
							className="h-11 w-full rounded-[3px] border border-border-gray bg-white px-3 text-sm outline-none focus:border-brand-teal"
							data-testid={`teacher-case-cme-option-${index}`}
							onChange={(event) => updateOption(option.id, event.target.value)}
							placeholder={`Option ${index + 1}`}
							value={option.text}
						/>
						<Button
							disabled={question.options.length <= 2}
							onClick={() => removeOption(option.id)}
							size="sm"
							variant="secondary"
						>
							Remove
						</Button>
					</div>
				))}
			</div>
			<div className="mt-5 flex flex-wrap gap-3">
				<Button
					data-testid="teacher-case-add-cme-option"
					disabled={question.options.length >= 5}
					onClick={addOption}
					variant="secondary"
				>
					Add option
				</Button>
				<Button
					data-testid="teacher-case-add-cme-question"
					disabled={questions.length >= 5}
					onClick={addQuestion}
				>
					Add question
				</Button>
				<Button
					data-testid="teacher-case-remove-cme-question"
					disabled={questions.length <= 1}
					onClick={removeQuestion}
					variant="secondary"
				>
					Remove question
				</Button>
			</div>
			{errors.length > 0 ? (
				<p
					className="mt-4 text-sm font-semibold text-error-red"
					data-testid="teacher-case-cme-validation"
				>
					{errors[0]}
				</p>
			) : null}
		</div>
	);
}
