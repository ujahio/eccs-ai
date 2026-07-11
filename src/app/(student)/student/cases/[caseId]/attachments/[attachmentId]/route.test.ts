import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createStudentCaseAttachmentUrl: vi.fn(),
	getCaseMaterialStorage: vi.fn(),
	getStudentCaseAttachment: vi.fn(),
	getSessionAuthResources: vi.fn(),
	isValidStudentCaseAttachmentUrl: vi.fn(),
	requireStudentSession: vi.fn(),
	studentCaseAttachmentUrlExpiresAt: vi.fn(),
}));

vi.mock("@/features/student/cases/student-case", () => ({
	createStudentCaseAttachmentUrl: mocks.createStudentCaseAttachmentUrl,
	getStudentCaseAttachment: mocks.getStudentCaseAttachment,
	isValidStudentCaseAttachmentUrl: mocks.isValidStudentCaseAttachmentUrl,
	studentCaseAttachmentUrlExpiresAt: mocks.studentCaseAttachmentUrlExpiresAt,
}));

vi.mock("@/features/case-materials/storage", () => ({
	getCaseMaterialStorage: mocks.getCaseMaterialStorage,
}));

vi.mock("@/lib/aws/resources", () => ({
	getSessionAuthResources: mocks.getSessionAuthResources,
}));

vi.mock("@/lib/auth/session", () => ({
	requireStudentSession: mocks.requireStudentSession,
}));

let GET: typeof import("./route").GET;

beforeAll(async () => {
	({ GET } = await import("./route"));
});

beforeEach(() => {
	mocks.getStudentCaseAttachment.mockReset();
	mocks.createStudentCaseAttachmentUrl.mockReset();
	mocks.getCaseMaterialStorage.mockReset();
	mocks.getSessionAuthResources.mockReset();
	mocks.isValidStudentCaseAttachmentUrl.mockReset();
	mocks.requireStudentSession.mockReset();
	mocks.studentCaseAttachmentUrlExpiresAt.mockReset();
	mocks.createStudentCaseAttachmentUrl.mockReturnValue(
		"/student/cases/case-1/attachments/attachment-1?disposition=inline&expires=2000&signature=fresh",
	);
	mocks.getCaseMaterialStorage.mockReturnValue({
		getSignedReadUrl: vi.fn(async () => "https://materials.example/signed.pdf"),
	});
	mocks.getSessionAuthResources.mockReturnValue({
		betterAuthSecret: "test-secret",
	});
	mocks.requireStudentSession.mockResolvedValue({
		profile: { profileId: "student-1" },
	});
	mocks.studentCaseAttachmentUrlExpiresAt.mockReturnValue(2_000);
});

function routeContext() {
	return {
		params: Promise.resolve({
			attachmentId: "attachment-1",
			caseId: "case-1",
		}),
	};
}

describe("student case attachment route", () => {
	it("redirects unsigned access links to fresh short-lived signed URLs", async () => {
		mocks.getStudentCaseAttachment.mockResolvedValue({
			contentType: "application/pdf",
			name: "teaching-resource.pdf",
			storageKey: "case-materials/case-1/attachment-1.pdf",
		});

		const response = await GET(
			new Request(
				"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=inline",
			),
			routeContext(),
		);

		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe(
			"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=inline&expires=2000&signature=fresh",
		);
		expect(mocks.createStudentCaseAttachmentUrl).toHaveBeenCalledWith({
			attachmentId: "attachment-1",
			caseId: "case-1",
			disposition: "inline",
			expiresAt: 2_000,
			secret: "test-secret",
		});
	});

	it("redirects a valid signed app URL to a storage signed URL", async () => {
		mocks.isValidStudentCaseAttachmentUrl.mockReturnValue(true);
		mocks.getStudentCaseAttachment.mockResolvedValue({
			contentType: "application/pdf",
			name: "teaching resource.pdf",
			storageKey: "case-materials/case-1/attachment-1.pdf",
		});

		const response = await GET(
			new Request(
				"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=inline&expires=1000&signature=valid",
			),
			routeContext(),
		);

		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe(
			"https://materials.example/signed.pdf",
		);
		expect(mocks.requireStudentSession).toHaveBeenCalled();
		expect(mocks.getStudentCaseAttachment).toHaveBeenCalledWith({
			attachmentId: "attachment-1",
			caseId: "case-1",
		});
		expect(mocks.getCaseMaterialStorage().getSignedReadUrl).toHaveBeenCalledWith(
			{
				disposition: "inline",
				name: "teaching resource.pdf",
				storageKey: "case-materials/case-1/attachment-1.pdf",
			},
		);
	});

	it("passes attachment disposition to the storage signed URL", async () => {
		mocks.isValidStudentCaseAttachmentUrl.mockReturnValue(true);
		mocks.getStudentCaseAttachment.mockResolvedValue({
			contentType: "application/pdf",
			name: "teaching-resource.pdf",
			storageKey: "case-materials/case-1/attachment-1.pdf",
		});

		const response = await GET(
			new Request(
				"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=attachment&expires=1000&signature=valid",
			),
			routeContext(),
		);

		expect(response.status).toBe(307);
		expect(mocks.getCaseMaterialStorage().getSignedReadUrl).toHaveBeenCalledWith(
			{
				disposition: "attachment",
				name: "teaching-resource.pdf",
				storageKey: "case-materials/case-1/attachment-1.pdf",
			},
		);
	});

	it("rejects expired or tampered signed URLs before loading the attachment", async () => {
		mocks.isValidStudentCaseAttachmentUrl.mockReturnValue(false);

		const response = await GET(
			new Request(
				"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=inline&expires=1000&signature=bad",
			),
			routeContext(),
		);

		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Attachment link expired.");
		expect(mocks.getStudentCaseAttachment).not.toHaveBeenCalled();
	});

	it("returns not found when the attachment is unavailable or the case expired", async () => {
		mocks.isValidStudentCaseAttachmentUrl.mockReturnValue(true);
		mocks.getStudentCaseAttachment.mockResolvedValue(null);

		const response = await GET(
			new Request(
				"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=inline&expires=1000&signature=valid",
			),
			routeContext(),
		);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Attachment not found.");
	});
});
