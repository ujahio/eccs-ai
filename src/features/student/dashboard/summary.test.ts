import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetE2EAuthStore,
	seedE2EStudentCertificates,
	seedE2ETeacherCases,
} from "@/lib/e2e/in-memory-auth";

vi.mock("server-only", () => ({}));

let DynamoStudentDashboardRepository: typeof import("./summary").DynamoStudentDashboardRepository;
let getStudentCertificateHistory: typeof import("./summary").getStudentCertificateHistory;
let InMemoryStudentDashboardRepository: typeof import("./summary").InMemoryStudentDashboardRepository;

beforeAll(async () => {
	({
		DynamoStudentDashboardRepository,
		getStudentCertificateHistory,
		InMemoryStudentDashboardRepository,
	} = await import("./summary"));
});

beforeEach(() => {
	resetE2EAuthStore();
});

const certificateBranding = {
	organizationName: "E-Clinical Case Solutions",
	shortName: "ECCS",
};

describe("InMemoryStudentDashboardRepository", () => {
	it("returns the active case and newest three student certificates", async () => {
		const now = Date.UTC(2026, 6, 7);
		seedE2ETeacherCases([
			{
				caseId: "expired-case",
				description: "Expired case description.",
				title: "Expired case",
				lifecycle: "published",
				publishedAt: now - 10_000,
				deadlineAt: now - 1_000,
				completionCount: 1,
				feedbackCount: 0,
			},
			{
				caseId: "active-case",
				description: "A focused active case for learners.",
				title: "Acute endocrine case review",
				lifecycle: "published",
				publishedAt: now - 1_000,
				deadlineAt: now + 86_400_000,
				completionCount: 2,
				feedbackCount: 1,
			},
		]);
		seedE2EStudentCertificates([
			{
				certificateBranding,
				certificateId: "certificate-oldest",
				caseId: "case-oldest",
				caseTitle: "Older hidden certificate",
				completedAt: now - 40_000,
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			{
				certificateBranding,
				certificateId: "certificate-newest",
				caseId: "case-newest",
				caseTitle: "Latest certificate",
				completedAt: now - 1_000,
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			{
				certificateBranding,
				certificateId: "certificate-middle",
				caseId: "case-middle",
				caseTitle: "Middle certificate",
				completedAt: now - 2_000,
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			{
				certificateBranding,
				certificateId: "certificate-third",
				caseId: "case-third",
				caseTitle: "Third certificate",
				completedAt: now - 3_000,
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			{
				certificateBranding,
				certificateId: "other-student-certificate",
				caseId: "case-other",
				caseTitle: "Other student certificate",
				completedAt: now,
				studentDisplayName: "Morgan Lee",
				studentProfileId: "student-2",
			},
		]);
		const repository = new InMemoryStudentDashboardRepository();

		const summary = await repository.getSummary("student-1", now);

		expect(summary.activeCase).toEqual({
			caseId: "active-case",
			description: "A focused active case for learners.",
			title: "Acute endocrine case review",
			deadlineAt: now + 86_400_000,
		});
		expect(
			summary.recentCertificates.map((certificate) => certificate.certificateId),
		).toEqual(["certificate-newest", "certificate-middle", "certificate-third"]);
		expect(summary.recentCertificates[0]?.certificateBranding).toEqual(
			certificateBranding,
		);
		expect(summary.recentCertificates).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ certificateId: "other-student-certificate" }),
			]),
		);
	});

	it("returns all certificate history for the student", async () => {
		const now = Date.UTC(2026, 6, 7);
		seedE2EStudentCertificates([
			{
				certificateBranding,
				certificateId: "certificate-oldest",
				caseId: "case-oldest",
				caseTitle: "Older certificate",
				completedAt: now - 40_000,
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			{
				certificateBranding,
				certificateId: "certificate-newest",
				caseId: "case-newest",
				caseTitle: "Latest certificate",
				completedAt: now - 1_000,
				studentDisplayName: "Jordan Adebayo",
				studentProfileId: "student-1",
			},
			{
				certificateBranding,
				certificateId: "other-student-certificate",
				caseId: "case-other",
				caseTitle: "Other student certificate",
				completedAt: now,
				studentDisplayName: "Morgan Lee",
				studentProfileId: "student-2",
			},
		]);

		const previousMode = process.env.AUTH_E2E_MODE;
		process.env.AUTH_E2E_MODE = "memory";

		let certificates: Awaited<ReturnType<typeof getStudentCertificateHistory>>;
		try {
			certificates = await getStudentCertificateHistory("student-1");
		} finally {
			process.env.AUTH_E2E_MODE = previousMode;
		}

		expect(certificates.map((certificate) => certificate.certificateId)).toEqual([
			"certificate-newest",
			"certificate-oldest",
		]);
	});
});

describe("DynamoStudentDashboardRepository", () => {
	it("returns active case and recent certificate records", async () => {
		const now = Date.UTC(2026, 6, 7);
		const documentClient = {
			send: vi.fn(async (command: { input: Record<string, unknown> }) => {
				if (command.input.TableName === "TeacherCaseTable") {
					return {
						Items: [
							{
								caseId: "active-case",
								description: "A focused active case for learners.",
								title: "Acute endocrine case review",
								lifecycle: "published",
								deadlineAt: now + 86_400_000,
								publishedAt: now - 1_000,
							},
						],
					};
				}

				return {
					Items: [
						{
							certificateBranding,
							certificateId: "certificate-newest",
							caseId: "case-newest",
							caseTitle: "Latest certificate",
							completedAt: now - 1_000,
							studentDisplayName: "Jordan Adebayo",
							studentProfileId: "student-1",
						},
					],
				};
			}),
		} as unknown as DynamoDBDocumentClient;
		const repository = new DynamoStudentDashboardRepository(
			"TeacherCaseTable",
			"StudentCertificateTable",
			documentClient,
		);

		const summary = await repository.getSummary("student-1", now);

		expect(summary.activeCase?.caseId).toBe("active-case");
		expect(summary.recentCertificates).toHaveLength(1);
	});
});
