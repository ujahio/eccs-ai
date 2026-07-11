import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetE2EAuthStore,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

vi.mock("server-only", () => ({}));

const attachmentSigningSecret = "student-case-test-secret";

const activeCase = {
	caseId: "active-case",
	title: "Acute endocrine review",
	description: "A focused case description for dashboard and case flow.",
	lifecycle: "published" as const,
	publishedAt: 1_000,
	deadlineAt: 5_000,
	completionCount: 0,
	feedbackCount: 0,
	draft: {
		title: "Acute endocrine review",
		description: "Draft case description for learners.",
		presentation:
			"Patient history, presenting symptoms, laboratory findings, and clinical decision context.",
		modelAnswer: "Model answer placeholder.",
		lectureText: "Lecture text placeholder.",
		attachments: [
			{
				id: "attachment-1",
				name: "teaching-resource.pdf",
				size: 18,
				storageKey: "case-materials/active-case/attachment-1.pdf",
				type: "application/pdf",
				lastModified: 1,
			},
		],
		cmeQuestions: [],
		deadlineDate: "2026-07-31",
	},
};

describe("InMemoryStudentCaseRepository", () => {
	beforeEach(() => {
		resetE2EAuthStore();
	});

	it("returns active case presentation content", async () => {
		const { InMemoryStudentCaseRepository } = await import("./student-case");
		seedE2ETeacherCases([activeCase]);

		const repository = new InMemoryStudentCaseRepository();
		const now = 2_000;

		await expect(
			repository.getActiveCasePresentation("active-case", now),
		).resolves.toMatchObject({
			caseId: "active-case",
			deadlineAt: 5_000,
			lectureText: "Lecture text placeholder.",
			modelAnswer: "Model answer placeholder.",
			presentation:
				"Patient history, presenting symptoms, laboratory findings, and clinical decision context.",
		});
		const result = await repository.getActiveCasePresentation("active-case", now);
		const attachment = result?.attachments[0];

		expect(attachment).toMatchObject({
			attachmentId: "attachment-1",
			downloadUrl: expect.stringContaining("disposition=attachment"),
			name: "teaching-resource.pdf",
			size: 18,
			type: "application/pdf",
			viewUrl: expect.stringContaining("disposition=inline"),
		});
		expect(attachment?.viewUrl).not.toContain("signature=");
		expect(attachment?.downloadUrl).not.toContain("signature=");
	});

	it("returns active PDF attachment storage references only before the deadline", async () => {
		const { InMemoryStudentCaseRepository } = await import("./student-case");
		seedE2ETeacherCases([activeCase]);

		const repository = new InMemoryStudentCaseRepository();

		await expect(
			repository.getActiveCaseAttachment("active-case", "attachment-1", 2_000),
		).resolves.toMatchObject({
			contentType: "application/pdf",
			name: "teaching-resource.pdf",
			storageKey: "case-materials/active-case/attachment-1.pdf",
		});
		await expect(
			repository.getActiveCaseAttachment("active-case", "attachment-1", 5_001),
		).resolves.toBeNull();
	});

	it("blocks expired case presentation access", async () => {
		const { InMemoryStudentCaseRepository } = await import("./student-case");
		seedE2ETeacherCases([activeCase]);

		const repository = new InMemoryStudentCaseRepository();

		await expect(
			repository.getActiveCasePresentation("active-case", 5_001),
		).resolves.toBeNull();
	});
});

describe("student case attachment signed URLs", () => {
	it("rejects expired or tampered attachment links", async () => {
		const {
			createStudentCaseAttachmentUrl,
			isValidStudentCaseAttachmentUrl,
		} = await import("./student-case");
		const signedUrl = createStudentCaseAttachmentUrl({
			attachmentId: "attachment-1",
			caseId: "active-case",
			disposition: "inline",
			expiresAt: 3_000,
			secret: attachmentSigningSecret,
		});
		const signature = new URL(signedUrl, "http://localhost").searchParams.get(
			"signature",
		);

		expect(
			isValidStudentCaseAttachmentUrl({
				attachmentId: "attachment-1",
				caseId: "active-case",
				disposition: "inline",
				expiresAt: 3_000,
				now: 2_999,
				secret: attachmentSigningSecret,
				signature,
			}),
		).toBe(true);
		expect(
			isValidStudentCaseAttachmentUrl({
				attachmentId: "attachment-1",
				caseId: "active-case",
				disposition: "inline",
				expiresAt: 3_000,
				now: 3_000,
				secret: attachmentSigningSecret,
				signature,
			}),
		).toBe(false);
		expect(
			isValidStudentCaseAttachmentUrl({
				attachmentId: "attachment-2",
				caseId: "active-case",
				disposition: "inline",
				expiresAt: 3_000,
				now: 2_999,
				secret: attachmentSigningSecret,
				signature,
			}),
		).toBe(false);
	});
});

describe("DynamoStudentCaseRepository", () => {
	it("loads active published case content by id", async () => {
		const { DynamoStudentCaseRepository } = await import("./student-case");
		const documentClient = {
			send: vi.fn(async () => ({ Item: activeCase })),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoStudentCaseRepository(
			"TeacherCaseTable",
			documentClient,
		);

		const presentation = await repository.getActiveCasePresentation(
			"active-case",
			2_000,
		);

		expect(presentation?.caseId).toBe("active-case");
		expect(presentation?.lectureText).toBe("Lecture text placeholder.");
		expect(presentation?.modelAnswer).toBe("Model answer placeholder.");
		expect(presentation?.presentation).toContain("Patient history");
		expect(presentation?.attachments[0]?.downloadUrl).toContain(
			"disposition=attachment",
		);
	});

	it("loads active PDF attachment metadata by id", async () => {
		const { DynamoStudentCaseRepository } = await import("./student-case");
		const documentClient = {
			send: vi.fn(async () => ({ Item: activeCase })),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoStudentCaseRepository(
			"TeacherCaseTable",
			documentClient,
		);

		const attachment = await repository.getActiveCaseAttachment(
			"active-case",
			"attachment-1",
			2_000,
		);

		expect(attachment?.contentType).toBe("application/pdf");
		expect(attachment?.name).toBe("teaching-resource.pdf");
		expect(attachment?.storageKey).toBe(
			"case-materials/active-case/attachment-1.pdf",
		);
	});
});
