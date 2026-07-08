"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActiveAuthoringSection } from "./active-section";
import {
	caseAuthoringSections,
	createDraftId,
	createEmptyCmeQuestion,
	caseDraftFromUnknown,
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
		let isMounted = true;
		const animationFrame = window.requestAnimationFrame(() => {
			void (async () => {
				try {
					const response = await fetch("/api/teacher/case-draft");

					if (!response.ok) {
						throw new Error("Draft load failed.");
					}

					const body = (await response.json()) as { draft?: unknown };

					if (body.draft && isMounted) {
						setDraft(draftForEditing(caseDraftFromUnknown(body.draft)));
					}
				} catch {
					if (isMounted) {
						setDraftStatus("error");
					}
				}
			})();
		});

		return () => {
			isMounted = false;
			window.cancelAnimationFrame(animationFrame);
		};
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

	async function saveDraft() {
		try {
			setDraftStatus("saving");
			const response = await fetch("/api/teacher/case-draft", {
				body: JSON.stringify({ draft: draftForStorage(draft) }),
				headers: {
					"content-type": "application/json",
				},
				method: "PUT",
			});

			if (!response.ok) {
				throw new Error("Draft save failed.");
			}

			const body = (await response.json()) as { draft?: unknown };
			const savedDraft = body.draft
				? draftForEditing(caseDraftFromUnknown(body.draft))
				: draftForEditing(draftForStorage(draft));

			setDraft(savedDraft);
			setIsDirty(false);
			setDraftStatus("saved");
		} catch {
			setDraftStatus("error");
		}
	}

	function selectSection(section: CaseAuthoringSection) {
		if (isDirty) {
			setSectionWarning(
				"Unsaved changes stay on this page. Use Save Draft to persist them.",
			);
		} else {
			setSectionWarning("");
		}

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

	async function addPdfAttachments(files: FileList | null) {
		if (!files) {
			return;
		}

		const pdfFiles = Array.from(files).filter(
			(file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
		);
		const attachments = await Promise.all(pdfFiles.map(async (file) => {
			const previewUrl = URL.createObjectURL(file);
			attachmentPreviewUrls.current.add(previewUrl);

			return {
				dataUrl: await readFileAsDataUrl(file),
				id: createDraftId("attachment"),
				name: file.name,
				size: file.size,
				type: file.type || "application/pdf",
				lastModified: file.lastModified,
				previewUrl,
			};
		}));

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

function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();

		reader.addEventListener("load", () => {
			resolve(typeof reader.result === "string" ? reader.result : "");
		});
		reader.addEventListener("error", () => reject(reader.error));
		reader.readAsDataURL(file);
	});
}
