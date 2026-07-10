import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResendRegistrationEmailSender } from "./email";

const mocks = vi.hoisted(() => ({
	sendEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("resend", () => ({
	Resend: vi.fn(function () {
		return {
			emails: {
				send: mocks.sendEmail,
			},
		};
	}),
}));

describe("ResendRegistrationEmailSender", () => {
	beforeEach(() => {
		mocks.sendEmail.mockReset();
	});

	it("throws when Resend returns an email delivery error", async () => {
		mocks.sendEmail.mockResolvedValue({
			data: null,
			error: {
				message: "Domain example.invalid is not verified",
				name: "invalid_from_address",
				statusCode: 403,
			},
			headers: {},
		});

		const sender = new ResendRegistrationEmailSender(
			"no-reply@example.invalid",
			"re_test",
			"https://eccs.example",
		);

		await expect(
			sender.sendNewCasePublishedEmail({
				caseTitle: "Acute endocrine review",
				deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
				firstName: "Jordan",
				to: "student@example.com",
			}),
		).rejects.toThrow(
			"Resend email failed: invalid_from_address: Domain example.invalid is not verified",
		);

		expect(mocks.sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				from: "no-reply@example.invalid",
				subject: "New ECCS case available: Acute endocrine review",
				to: "student@example.com",
			}),
		);
	});

	it("uses the approved deadline reminder subject", async () => {
		mocks.sendEmail.mockResolvedValue({
			data: { id: "email-1" },
			error: null,
			headers: {},
		});

		const sender = new ResendRegistrationEmailSender(
			"no-reply@example.invalid",
			"re_test",
			"https://eccs.example",
		);

		await sender.sendDeadlineReminderEmail({
			caseTitle: "Acute endocrine review",
			deadlineAt: Date.UTC(2026, 7, 12, 19, 59, 59, 999),
			firstName: "Jordan",
			to: "student@example.com",
		});

		expect(mocks.sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				subject: "Complete your ECCS case before it closes",
			}),
		);
	});
});
