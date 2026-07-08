"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import type {
	TeacherCaseLibraryArchivedCase,
	TeacherCaseLibrarySummary,
} from "./cases";

type TeacherCaseMode = "draft" | "archived";
type TeacherDraftCase = TeacherCaseLibrarySummary["draftCases"][number];

type TeacherCaseCardRecord =
	| (TeacherDraftCase & {
			kind: "draft";
	  })
	| (TeacherCaseLibraryArchivedCase & {
			kind: "archived";
	  });

const CASE_MODE_DETAILS = {
	draft: {
		emptyStateTestId: "teacher-case-library-no-drafts",
		emptyStateTitle: "No draft cases.",
		listTestId: "teacher-draft-cases",
	},
	archived: {
		emptyStateTestId: "teacher-case-library-no-archived-cases",
		emptyStateTitle: "No archived cases.",
		listTestId: "teacher-library-archived-cases",
	},
} satisfies Record<
	TeacherCaseMode,
	{
		emptyStateTestId: string;
		emptyStateTitle: string;
		listTestId: string;
	}
>;

export function TeacherCaseLibrary({
	archivedCases,
	draftCases,
}: TeacherCaseLibrarySummary) {
	const [drafts, setDrafts] = useState(draftCases);
	const [activeMode, setActiveMode] = useState<TeacherCaseMode>(
		draftCases.length > 0 ? "draft" : "archived",
	);
	const [draftPendingDelete, setDraftPendingDelete] =
		useState<TeacherDraftCase | null>(null);
	const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">("idle");
	const [deleteError, setDeleteError] = useState("");
	const activeModeDetails = CASE_MODE_DETAILS[activeMode];
	const cards = caseRecordsForMode(activeMode, drafts, archivedCases);

	async function confirmDeleteDraft() {
		if (!draftPendingDelete) {
			return;
		}

		try {
			setDeleteStatus("deleting");
			setDeleteError("");
			const response = await fetch(
				`/api/teacher/case-draft?caseId=${encodeURIComponent(
					draftPendingDelete.caseId,
				)}`,
				{ method: "DELETE" },
			);

			if (!response.ok) {
				throw new Error("Draft deletion failed.");
			}

			setDrafts((currentDrafts) =>
				currentDrafts.filter(
					(draft) => draft.caseId !== draftPendingDelete.caseId,
				),
			);
			setDraftPendingDelete(null);
		} catch {
			setDeleteError("The draft could not be deleted. Try again.");
		} finally {
			setDeleteStatus("idle");
		}
	}

	return (
		<section
			className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8"
			data-testid="teacher-case-library-root"
		>
			<CaseModeSwitch
				activeMode={activeMode}
				archivedCount={archivedCases.length}
				draftCount={drafts.length}
				onModeChange={setActiveMode}
			/>

			{cards.length > 0 ? (
				<div
					className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
					data-testid={activeModeDetails.listTestId}
				>
					{cards.map((caseRecord) => (
						<TeacherCaseCard
							caseRecord={caseRecord}
							key={caseRecord.caseId}
							onRequestDelete={
								caseRecord.kind === "draft"
									? () => {
											setDraftPendingDelete(caseRecord);
											setDeleteError("");
										}
									: undefined
							}
						/>
					))}
				</div>
			) : (
				<EmptyState
					testId={activeModeDetails.emptyStateTestId}
					title={activeModeDetails.emptyStateTitle}
				/>
			)}

			{draftPendingDelete ? (
				<DeleteDraftDialog
					deleteError={deleteError}
					deleteStatus={deleteStatus}
					draft={draftPendingDelete}
					onCancel={() => {
						setDraftPendingDelete(null);
						setDeleteError("");
					}}
					onConfirm={confirmDeleteDraft}
				/>
			) : null}
		</section>
	);
}

function caseRecordsForMode(
	activeMode: TeacherCaseMode,
	drafts: TeacherDraftCase[],
	archivedCases: TeacherCaseLibraryArchivedCase[],
): TeacherCaseCardRecord[] {
	return activeMode === "draft"
		? drafts.map((draft) => ({ ...draft, kind: "draft" as const }))
		: archivedCases.map((caseRecord) => ({
				...caseRecord,
				kind: "archived" as const,
			}));
}

function CaseModeSwitch({
	activeMode,
	archivedCount,
	draftCount,
	onModeChange,
}: {
	activeMode: TeacherCaseMode;
	archivedCount: number;
	draftCount: number;
	onModeChange: (mode: TeacherCaseMode) => void;
}) {
	return (
		<div
			className="mb-5 border border-border-gray bg-white p-3"
			data-testid="teacher-case-library-mode-switch"
		>
			<div className="grid gap-2 sm:w-auto sm:grid-cols-2">
				<CaseModeButton
					count={draftCount}
					isActive={activeMode === "draft"}
					label="Drafts"
					mode="draft"
					onClick={() => onModeChange("draft")}
					testId="teacher-case-library-draft-mode"
				/>
				<CaseModeButton
					count={archivedCount}
					isActive={activeMode === "archived"}
					label="Archived"
					mode="archived"
					onClick={() => onModeChange("archived")}
					testId="teacher-case-library-archived-mode"
				/>
			</div>
		</div>
	);
}

function CaseModeButton({
	count,
	isActive,
	label,
	mode,
	onClick,
	testId,
}: {
	count: number;
	isActive: boolean;
	label: string;
	mode: TeacherCaseMode;
	onClick: () => void;
	testId: string;
}) {
	return (
		<button
			aria-pressed={isActive}
			className={[
				"min-h-12 min-w-36 border px-4 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal",
				isActive
					? `${mode === "draft" ? "border-brand-teal" : "border-primary-action"} bg-soft-section text-primary-text`
					: "border-border-gray bg-white text-primary-text hover:border-primary-action hover:bg-app-canvas",
			].join(" ")}
			data-testid={testId}
			onClick={onClick}
			type="button"
		>
			<span className="flex items-center justify-between gap-3 text-sm font-semibold">
				{label}
				<span
					aria-hidden="true"
					className={[
						"flex h-5 w-5 items-center justify-center border text-xs",
						isActive
							? `${mode === "draft" ? "border-brand-teal text-brand-teal" : "border-primary-action text-primary-action"} bg-white`
							: "border-border-gray text-transparent",
					].join(" ")}
				>
					&bull;
				</span>
			</span>
			<span
				className={[
					"mt-1 block text-xs",
					isActive ? "text-primary-text" : "text-muted-gray",
				].join(" ")}
			>
				{count} {count === 1 ? "case" : "cases"}
			</span>
		</button>
	);
}

function TeacherCaseCard({
	caseRecord,
	onRequestDelete,
}: {
	caseRecord: TeacherCaseCardRecord;
	onRequestDelete?: () => void;
}) {
	return (
		<article
			className={[
				"relative flex min-h-52 flex-col border border-border-gray px-4 py-5 text-primary-text transition hover:border-primary-action",
				caseRecord.kind === "draft"
					? "border-l-4 border-l-brand-teal bg-white"
					: "border-l-4 border-l-primary-action bg-soft-section",
			].join(" ")}
			data-testid={
				caseRecord.kind === "draft"
					? "teacher-draft-case-card"
					: "teacher-library-archived-case-card"
			}
		>
			{caseRecord.kind === "draft" ? (
				<Link
					aria-label={`Edit ${caseRecord.title}`}
					className="block flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-teal"
					href={`/teacher/cases/${encodeURIComponent(caseRecord.caseId)}/edit`}
				>
					<TeacherCaseCardContent caseRecord={caseRecord} />
				</Link>
			) : (
				<TeacherCaseCardContent caseRecord={caseRecord} />
			)}

			{caseRecord.kind === "draft" ? (
				<div className="mt-4 flex flex-col gap-2 border-t border-border-gray pt-3 sm:flex-row">
					<ButtonLink
						className="w-full sm:w-auto"
						data-testid="teacher-draft-edit"
						href={`/teacher/cases/${encodeURIComponent(caseRecord.caseId)}/edit`}
						size="sm"
						title={`Edit ${caseRecord.title}`}
						variant="secondary"
					>
						Edit
					</ButtonLink>
					<Button
						className="w-full sm:w-auto"
						data-testid="teacher-draft-delete"
						onClick={onRequestDelete}
						title={`Delete ${caseRecord.title}`}
						variant="secondary"
						size="sm"
					>
						Delete
					</Button>
				</div>
			) : null}
		</article>
	);
}

function TeacherCaseCardContent({
	caseRecord,
}: {
	caseRecord: TeacherCaseCardRecord;
}) {
	return (
		<>
			<div className="mb-4 flex items-start justify-between gap-4">
				<CaseStudyIcon tone={caseRecord.kind} />
				<CasePill
					tone={caseRecord.kind === "draft" ? "draft" : "archived"}
					value={caseRecord.kind === "draft" ? "Draft" : "Archived"}
				/>
			</div>
			<h2 className="text-base font-semibold leading-snug">{caseRecord.title}</h2>
			<p className="mt-2 min-h-[54px] text-sm leading-5 text-muted-gray">
				{caseDescription(caseRecord)}
			</p>
			<div className="mt-5 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
				<CaseMetric
					label={caseRecord.kind === "draft" ? "Updated" : "Created"}
					value={formatDate(caseDate(caseRecord))}
				/>
				<CaseMetric label="Deadline" value={caseDeadline(caseRecord)} />
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				{caseRecord.kind === "draft" ? (
					<CasePill value={`PDFs ${caseRecord.attachmentCount}`} />
				) : (
					<>
						<CasePill value={`${caseRecord.feedbackCount} Feedbacks`} />
						<CasePill value={`${caseRecord.completionCount} Responses`} />
					</>
				)}
			</div>
		</>
	);
}

function CaseStudyIcon({ tone }: { tone: TeacherCaseMode }) {
	return (
		<svg
			aria-hidden="true"
			className={[
				"h-7 w-7",
				tone === "draft" ? "text-brand-teal" : "text-primary-action",
			].join(" ")}
			focusable="false"
			viewBox="0 0 32 32"
		>
			<rect
				fill="none"
				height="24"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.6"
				width="20"
				x="6"
				y="4"
			/>
			<path
				d="M16 10v12M10 16h12"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="1.8"
			/>
			<path
				d="M10 4v-1h12v1"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="1.6"
			/>
		</svg>
	);
}

function CaseMetric({ label, value }: { label: string; value: string }) {
	return (
		<p className="font-semibold leading-5">
			<span>{label}: </span>
			<span className="font-medium text-muted-gray">{value}</span>
		</p>
	);
}

function CasePill({
	tone = "neutral",
	value,
}: {
	tone?: "archived" | "draft" | "neutral";
	value: string;
}) {
	const toneClass =
		tone === "draft"
			? "border-brand-teal bg-success-soft text-primary-text"
			: tone === "archived"
				? "border-primary-action bg-primary-action text-white"
				: "border-border-gray bg-app-canvas text-muted-gray";

	return (
		<span className={["border px-2 py-1 text-xs", toneClass].join(" ")}>
			{value}
		</span>
	);
}

function DeleteDraftDialog({
	deleteError,
	deleteStatus,
	draft,
	onCancel,
	onConfirm,
}: {
	deleteError: string;
	deleteStatus: "idle" | "deleting";
	draft: TeacherDraftCase;
	onCancel: () => void;
	onConfirm: () => void | Promise<void>;
}) {
	return (
		<div
			aria-labelledby="teacher-delete-draft-title"
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(47,64,80,0.72)] px-4 py-6"
			data-testid="teacher-delete-draft-dialog"
			role="dialog"
		>
			<div className="w-full max-w-md rounded border border-border-gray bg-white p-5 text-primary-text shadow-[0_8px_24px_rgba(47,64,80,0.06)] sm:p-6">
				<h2
					className="text-lg font-semibold"
					id="teacher-delete-draft-title"
				>
					Delete draft case?
				</h2>
				<p className="mt-3 text-sm leading-6 text-muted-gray">
					This permanently deletes <em>{draft.title}</em> and its saved case
					materials.
				</p>
				{deleteError ? (
					<p
						className="mt-3 text-sm font-semibold text-error-red"
						data-testid="teacher-delete-draft-error"
					>
						{deleteError}
					</p>
				) : null}
				<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<Button
						data-testid="teacher-delete-draft-cancel"
						disabled={deleteStatus === "deleting"}
						onClick={onCancel}
						variant="secondary"
					>
						Cancel
					</Button>
					<Button
						className="border-error-red text-error-red hover:border-error-red"
						data-testid="teacher-delete-draft-confirm"
						disabled={deleteStatus === "deleting"}
						onClick={onConfirm}
						title="Delete Draft"
						variant="secondary"
					>
						{deleteStatus === "deleting" ? "Deleting..." : "Delete Draft"}
					</Button>
				</div>
			</div>
		</div>
	);
}

function EmptyState({ testId, title }: { testId: string; title: string }) {
	return (
		<div
			className="flex min-h-52 items-center border border-border-gray bg-white px-5 py-8"
			data-testid={testId}
		>
			<p className="text-sm font-semibold text-muted-gray">{title}</p>
		</div>
	);
}

function caseDescription(caseRecord: TeacherCaseCardRecord) {
	if (caseRecord.kind === "draft") {
		return (
			caseRecord.description.trim() ||
			"Saved draft case study ready to continue authoring."
		);
	}

	return "Review student responses, feedback, and completion activity for this archived case study.";
}

function caseDate(caseRecord: TeacherCaseCardRecord) {
	return caseRecord.kind === "draft"
		? caseRecord.updatedAt
		: caseRecord.publishedAt;
}

function caseDeadline(caseRecord: TeacherCaseCardRecord) {
	if (caseRecord.kind === "draft") {
		return formatDraftDeadlineDate(caseRecord.deadlineDate);
	}

	return formatDate(caseRecord.deadlineAt);
}

function formatDraftDeadlineDate(deadlineDate: string) {
	if (!deadlineDate) {
		return "Not set";
	}

	const [yearText = "", monthText = "", dayText = ""] = deadlineDate.split("-");
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day)
	) {
		return deadlineDate;
	}

	return formatDate(Date.UTC(year, month - 1, day));
}

function formatDate(epochMilliseconds: number) {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Asia/Dubai",
	}).format(new Date(epochMilliseconds));
}
