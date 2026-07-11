import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createStudentCaseAttachmentUrl: vi.fn(),
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
	mocks.getSessionAuthResources.mockReset();
	mocks.isValidStudentCaseAttachmentUrl.mockReset();
	mocks.requireStudentSession.mockReset();
	mocks.studentCaseAttachmentUrlExpiresAt.mockReset();
	mocks.createStudentCaseAttachmentUrl.mockReturnValue(
		"/student/cases/case-1/attachments/attachment-1?disposition=inline&expires=2000&signature=fresh",
	);
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
			bytes: new TextEncoder().encode("%PDF-1.4"),
			contentType: "application/pdf",
			name: "teaching-resource.pdf",
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

	it("returns an inline PDF when the signed URL is valid", async () => {
		mocks.isValidStudentCaseAttachmentUrl.mockReturnValue(true);
		mocks.getStudentCaseAttachment.mockResolvedValue({
			bytes: new TextEncoder().encode("%PDF-1.4"),
			contentType: "application/pdf",
			name: "teaching resource.pdf",
		});

		const response = await GET(
			new Request(
				"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=inline&expires=1000&signature=valid",
			),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");
		expect(response.headers.get("Content-Disposition")).toBe(
			'inline; filename="teaching resource.pdf"',
		);
		expect(mocks.requireStudentSession).toHaveBeenCalled();
		expect(mocks.getStudentCaseAttachment).toHaveBeenCalledWith({
			attachmentId: "attachment-1",
			caseId: "case-1",
		});
		expect(new TextDecoder().decode(await response.arrayBuffer())).toBe(
			"%PDF-1.4",
		);
	});

	it("returns a downloadable PDF when the signed URL asks for attachment disposition", async () => {
		mocks.isValidStudentCaseAttachmentUrl.mockReturnValue(true);
		mocks.getStudentCaseAttachment.mockResolvedValue({
			bytes: new TextEncoder().encode("%PDF-1.4"),
			contentType: "application/pdf",
			name: "teaching-resource.pdf",
		});

		const response = await GET(
			new Request(
				"http://localhost/student/cases/case-1/attachments/attachment-1?disposition=attachment&expires=1000&signature=valid",
			),
			routeContext(),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="teaching-resource.pdf"',
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
