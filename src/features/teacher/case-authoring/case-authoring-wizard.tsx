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
	type CaseDraftValidation,
	type CmeQuestionDraft,
	validateDraftForSave,
	validateDraftForPublish,
} from "./schema";
import {
	type DraftStatus,
	type PublishStatus,
	SectionNavigation,
	WizardContentFrame,
	WizardHeader,
	WizardStatusMessages,
} from "./wizard-frame";

export function CaseAuthoringWizard({
	activePublishedCase = null,
	draftCaseId = null,
}: {
	activePublishedCase?: ActivePublishedCaseSummary | null;
	draftCaseId?: string | null;
}) {
	const [draft, setDraft] = useState<CaseDraft>(emptyCaseDraft);
	const [currentDraftCaseId, setCurrentDraftCaseId] = useState<string | null>(
		draftCaseId,
	);
	const [activeSection, setActiveSection] =
		useState<CaseAuthoringSection>("title");
	const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
	const [isDirty, setIsDirty] = useState(false);
	const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
	const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
	const [saveValidation, setSaveValidation] = useState<CaseDraftValidation>({});
	const [publishValidation, setPublishValidation] = useState<CaseDraftValidation>(
		{},
	);
	const [sectionWarning, setSectionWarning] = useState("");
	const attachmentPreviewUrls = useRef(new Set<string>());
	const validation = useMemo(
		() => ({ ...validateDraftForPublish(draft), ...publishValidation }),
		[draft, publishValidation],
	);
	const readyToPublish = useMemo(() => isPublishReady(draft), [draft]);
	const hasPublishValidation = Object.keys(publishValidation).length > 0;
	const publishDisabled =
		!readyToPublish ||
		activePublishedCase !== null ||
		hasPublishValidation ||
		publishStatus === "publishing";

	useEffect(() => {
		if (!draftCaseId) {
			return;
		}

		let isMounted = true;
		const animationFrame = window.requestAnimationFrame(() => {
			void (async () => {
				try {
					const response = await fetch(
						`/api/teacher/case-draft?caseId=${encodeURIComponent(
							draftCaseId,
						)}`,
					);

					if (!response.ok) {
						throw new Error("Draft load failed.");
					}

					const body = (await response.json()) as {
						caseId?: unknown;
						draft?: unknown;
					};

					if (body.draft && isMounted) {
						setDraft(draftForEditing(caseDraftFromUnknown(body.draft)));
						setCurrentDraftCaseId(caseIdFromResponse(body) ?? draftCaseId);
					}
				} catch {
					if (isMounted) {
						setDraftStatus("load-error");
					}
				}
			})();
		});

		return () => {
			isMounted = false;
			window.cancelAnimationFrame(animationFrame);
		};
	}, [draftCaseId]);

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
		setPublishStatus("idle");
		setSaveValidation({});
		setPublishValidation({});
	}

	async function saveDraft() {
		const draftSaveValidation = validateDraftForSave(draft);

		if (Object.keys(draftSaveValidation).length > 0) {
			setDraftStatus("idle");
			setSaveValidation(draftSaveValidation);
			setSectionWarning("");
			setActiveSection("title");
			return;
		}

		try {
			setSaveValidation({});
			setSectionWarning("");
			setDraftStatus("saving");
			const response = await fetch("/api/teacher/case-draft", {
				body: JSON.stringify({
					...(currentDraftCaseId ? { caseId: currentDraftCaseId } : {}),
					draft: draftForStorage(draft),
				}),
				headers: {
					"content-type": "application/json",
				},
				method: "PUT",
			});

			if (!response.ok) {
				throw new Error("Draft save failed.");
			}

			const body = (await response.json()) as {
				caseId?: unknown;
				draft?: unknown;
			};
			const savedDraft = body.draft
				? draftForEditing(caseDraftFromUnknown(body.draft))
				: draftForEditing(draftForStorage(draft));
			const savedCaseId = caseIdFromResponse(body) ?? currentDraftCaseId;

			setDraft(savedDraft);
			if (savedCaseId) {
				setCurrentDraftCaseId(savedCaseId);

				if (!currentDraftCaseId) {
					window.history.replaceState(
						null,
						"",
						`/teacher/cases/${encodeURIComponent(savedCaseId)}/edit`,
					);
				}
			}
			setIsDirty(false);
			setDraftStatus("saved");
		} catch {
			setDraftStatus("error");
		}
	}

	async function publishCase() {
		if (publishDisabled) {
			return;
		}

		try {
			setSaveValidation({});
			setPublishValidation({});
			setSectionWarning("");
			setPublishStatus("publishing");
			const response = await fetch("/api/teacher/case-publish", {
				body: JSON.stringify({
					...(currentDraftCaseId ? { caseId: currentDraftCaseId } : {}),
					draft: draftForStorage(draft),
				}),
				headers: {
					"content-type": "application/json",
				},
				method: "POST",
			});

			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					validation?: CaseDraftValidation;
				} | null;

				if (body?.validation) {
					setPublishValidation(body.validation);
				}

				throw new Error("Case publish failed.");
			}

			setIsDirty(false);
			window.location.assign("/teacher");
		} catch {
			setPublishStatus("error");
			setActiveSection("review");
		}
	}

	function selectSection(section: CaseAuthoringSection) {
		if (isDirty) {
			setSectionWarning(
				"You have unsaved changes. Select Save Draft to store them.",
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
			<WizardHeader
				isDirty={isDirty}
				onSaveDraft={saveDraft}
				onPublish={publishCase}
				publishDisabled={publishDisabled}
			/>
			<WizardStatusMessages
				draftValidationMessage={saveValidation.title}
				draftStatus={draftStatus}
				publishStatus={publishStatus}
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
						onPublish={publishCase}
						publishDisabled={publishDisabled}
						removeAttachment={removeAttachment}
						removeQuestion={removeQuestion}
						saveValidation={saveValidation}
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

function caseIdFromResponse(body: { caseId?: unknown; draft?: unknown }) {
	if (typeof body.caseId === "string" && body.caseId.trim()) {
		return body.caseId;
	}

	if (
		typeof body.draft === "object" &&
		body.draft !== null &&
		"caseId" in body.draft
	) {
		const caseId = (body.draft as { caseId?: unknown }).caseId;

		return typeof caseId === "string" && caseId.trim() ? caseId : null;
	}

	return null;
}
