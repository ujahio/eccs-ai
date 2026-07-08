"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActiveAuthoringSection } from "./active-section";
import { draftStorageKey } from "./constants";
import {
	caseAuthoringSections,
	createDraftId,
	createEmptyCmeQuestion,
	draftForEditing,
	draftForStorage,
	emptyCaseDraft,
	isPublishReady,
	type ActivePublishedCaseSummary,
	type CaseAuthoringSection,
	type CaseDraft,
	type CmeQuestionDraft,
	validateDraftForPublish,
} from "./schema";
import {
	type DraftStatus,
	SectionNavigation,
	WizardContentFrame,
	WizardHeader,
	WizardStatusMessages,
} from "./wizard-frame";

export function CaseAuthoringWizard({
	activePublishedCase = null,
}: {
	activePublishedCase?: ActivePublishedCaseSummary | null;
}) {
	const [draft, setDraft] = useState<CaseDraft>(emptyCaseDraft);
	const [activeSection, setActiveSection] =
		useState<CaseAuthoringSection>("title");
	const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
	const [isDirty, setIsDirty] = useState(false);
	const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
	const [sectionWarning, setSectionWarning] = useState("");
	const attachmentPreviewUrls = useRef(new Set<string>());
	const validation = useMemo(() => validateDraftForPublish(draft), [draft]);
	const readyToPublish = useMemo(() => isPublishReady(draft), [draft]);

	useEffect(() => {
		const animationFrame = window.requestAnimationFrame(() => {
			const storedDraft = window.localStorage.getItem(draftStorageKey);
			if (!storedDraft) {
				return;
			}

			try {
				setDraft(draftForEditing({ ...emptyCaseDraft, ...JSON.parse(storedDraft) }));
			} catch {
				setDraftStatus("error");
			}
		});

		return () => window.cancelAnimationFrame(animationFrame);
	}, []);

	useEffect(() => {
		const previewUrls = attachmentPreviewUrls.current;

		return () => {
			for (const previewUrl of previewUrls) {
				URL.revokeObjectURL(previewUrl);
			}
			previewUrls.clear();
		};
	}, []);

	useEffect(() => {
		const warnBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirty) {
				return;
			}

			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", warnBeforeUnload);

		return () => window.removeEventListener("beforeunload", warnBeforeUnload);
	}, [isDirty]);

	function updateDraft(update: Partial<CaseDraft>) {
		setDraft((current) => ({ ...current, ...update }));
		setIsDirty(true);
		setDraftStatus("idle");
	}

	function saveDraft() {
		try {
			window.localStorage.setItem(
				draftStorageKey,
				JSON.stringify(draftForStorage(draft)),
			);
			setIsDirty(false);
			setDraftStatus("saved");
		} catch {
			setDraftStatus("error");
		}
	}

	function selectSection(section: CaseAuthoringSection) {
		if (isDirty) {
			const shouldContinue = window.confirm(
				"You have unsaved changes. Continue without saving this draft?",
			);

			if (!shouldContinue) {
				setSectionWarning("Save your draft before changing sections.");
				return;
			}
		}

		setSectionWarning("");
		setActiveSection(section);
	}

	function goToNextSection() {
		const currentIndex = caseAuthoringSections.indexOf(activeSection);
		const nextSection = caseAuthoringSections[currentIndex + 1];

		if (nextSection) {
			selectSection(nextSection);
		}
	}

	function goToPreviousSection() {
		const currentIndex = caseAuthoringSections.indexOf(activeSection);
		const previousSection = caseAuthoringSections[currentIndex - 1];

		if (previousSection) {
			selectSection(previousSection);
		}
	}

	function updateQuestion(updatedQuestion: CmeQuestionDraft) {
		updateDraft({
			cmeQuestions: draft.cmeQuestions.map((question, index) =>
				index === activeQuestionIndex ? updatedQuestion : question,
			),
		});
	}

	function addQuestion() {
		if (draft.cmeQuestions.length >= 5) {
			return;
		}

		const nextQuestions = [...draft.cmeQuestions, createEmptyCmeQuestion()];
		updateDraft({ cmeQuestions: nextQuestions });
		setActiveQuestionIndex(nextQuestions.length - 1);
	}

	function removeQuestion() {
		if (draft.cmeQuestions.length <= 1) {
			return;
		}

		const nextQuestions = draft.cmeQuestions.filter(
			(_question, index) => index !== activeQuestionIndex,
		);
		updateDraft({ cmeQuestions: nextQuestions });
		setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1));
	}

	function addPdfAttachments(files: FileList | null) {
		if (!files) {
			return;
		}

		const pdfFiles = Array.from(files).filter(
			(file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
		);
		const attachments = pdfFiles.map((file) => {
			const previewUrl = URL.createObjectURL(file);
			attachmentPreviewUrls.current.add(previewUrl);

			return {
				id: createDraftId("attachment"),
				name: file.name,
				size: file.size,
				type: file.type || "application/pdf",
				lastModified: file.lastModified,
				previewUrl,
			};
		});

		updateDraft({
			attachments: [...draft.attachments, ...attachments],
		});
	}

	function removeAttachment(attachmentId: string) {
		const attachment = draft.attachments.find(
			(currentAttachment) => currentAttachment.id === attachmentId,
		);

		if (attachment?.previewUrl) {
			URL.revokeObjectURL(attachment.previewUrl);
			attachmentPreviewUrls.current.delete(attachment.previewUrl);
		}

		updateDraft({
			attachments: draft.attachments.filter(
				(currentAttachment) => currentAttachment.id !== attachmentId,
			),
		});
	}

	return (
		<section
			className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
			data-testid="teacher-case-authoring-root"
		>
			<WizardHeader isDirty={isDirty} onSaveDraft={saveDraft} />
			<WizardStatusMessages
				draftStatus={draftStatus}
				sectionWarning={sectionWarning}
			/>

			<div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
				<SectionNavigation
					activeSection={activeSection}
					onSelectSection={selectSection}
				/>
				<WizardContentFrame
					activeSection={activeSection}
					onNextSection={goToNextSection}
					onPreviousSection={goToPreviousSection}
				>
					<ActiveAuthoringSection
						activeQuestionIndex={activeQuestionIndex}
						activeSection={activeSection}
						addPdfAttachments={addPdfAttachments}
						addQuestion={addQuestion}
						draft={draft}
						readyToPublish={readyToPublish}
						activePublishedCase={activePublishedCase}
						removeAttachment={removeAttachment}
						removeQuestion={removeQuestion}
						setActiveQuestionIndex={setActiveQuestionIndex}
						updateDraft={updateDraft}
						updateQuestion={updateQuestion}
						validation={validation}
					/>
				</WizardContentFrame>
			</div>
		</section>
	);
}
