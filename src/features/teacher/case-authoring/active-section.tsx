import type {
	CaseAuthoringSection,
	CaseDraft,
	CaseDraftValidation,
	CmeQuestionDraft,
} from "./schema";
import {
	CmeSection,
	LongTextSection,
	ResourcesSection,
	ReviewSection,
	TitleSection,
} from "./sections";

export function ActiveAuthoringSection({
	activeQuestionIndex,
	activeSection,
	addPdfAttachments,
	addQuestion,
	draft,
	readyToPublish,
	removeAttachment,
	removeQuestion,
	setActiveQuestionIndex,
	updateDraft,
	updateQuestion,
	validation,
}: {
	activeQuestionIndex: number;
	activeSection: CaseAuthoringSection;
	addPdfAttachments: (files: FileList | null) => void;
	addQuestion: () => void;
	draft: CaseDraft;
	readyToPublish: boolean;
	removeAttachment: (attachmentId: string) => void;
	removeQuestion: () => void;
	setActiveQuestionIndex: (index: number) => void;
	updateDraft: (update: Partial<CaseDraft>) => void;
	updateQuestion: (question: CmeQuestionDraft) => void;
	validation: CaseDraftValidation;
}) {
	if (activeSection === "title") {
		return <TitleSection draft={draft} updateDraft={updateDraft} />;
	}

	if (activeSection === "presentation") {
		return (
			<LongTextSection
				description="Use plain text or Markdown-style structure for the clinical scenario."
				label="Case Presentation"
				testId="teacher-case-presentation"
				value={draft.presentation}
				onChange={(presentation) => updateDraft({ presentation })}
			/>
		);
	}

	if (activeSection === "modelAnswer") {
		return (
			<LongTextSection
				description="Write the expert reasoning students will compare against after submitting their analysis."
				label="Model Answer"
				testId="teacher-case-model-answer"
				value={draft.modelAnswer}
				onChange={(modelAnswer) => updateDraft({ modelAnswer })}
			/>
		);
	}

	if (activeSection === "resources") {
		return (
			<ResourcesSection
				addPdfAttachments={addPdfAttachments}
				draft={draft}
				removeAttachment={removeAttachment}
				updateDeadlineDate={(deadlineDate) => updateDraft({ deadlineDate })}
				updateLectureText={(lectureText) => updateDraft({ lectureText })}
			/>
		);
	}

	if (activeSection === "cme") {
		return (
			<CmeSection
				activeQuestionIndex={activeQuestionIndex}
				addQuestion={addQuestion}
				removeQuestion={removeQuestion}
				setActiveQuestionIndex={setActiveQuestionIndex}
				updateQuestion={updateQuestion}
				questions={draft.cmeQuestions}
			/>
		);
	}

	return (
		<ReviewSection
			draft={draft}
			readyToPublish={readyToPublish}
			updateDraft={updateDraft}
			validation={validation}
		/>
	);
}
