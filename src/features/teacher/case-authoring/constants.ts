import type { CaseAuthoringSection } from "./schema";

export const draftStorageKey = "eccs.teacher.caseDraft.v1";

export const sectionLabels: Record<CaseAuthoringSection, string> = {
	title: "Title & Description",
	presentation: "Case Presentation",
	modelAnswer: "Model Answer",
	resources: "Case Study",
	cme: "CME Questions",
	review: "Final Review",
};
