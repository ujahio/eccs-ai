import { describe, expect, it } from "vitest";
import {
	ECCS_LOGO_CONTENT_ID,
	ECCS_LOGO_SRC,
	eccsLogoAttachment,
} from "./logo-attachment";
import {
	forgotPasswordUrl,
	renderEmailChangeVerificationEmail,
	renderPasswordChangedEmail,
	renderPasswordResetEmail,
	renderRegistrationVerificationEmail
} from "./transactional";

describe("ECCS transactional email templates", () => {
	it("renders the registration verification email with branded html and text", async () => {
		const email = await renderRegistrationVerificationEmail({
			firstName: "Jordan",
			verificationUrl: "https://eccs.example/verify-email?token=abc123",
			expiresInHours: 24
		});

		expect(email.html).toContain(ECCS_LOGO_SRC);
		expect(email.html).toContain("Verify account");
		expect(email.html).toContain(
			"https://eccs.example/verify-email?token=abc123"
		);
		expect(email.text).toContain("Hello Jordan");
		expect(email.text).toContain("This verification link expires in 24 hours.");
	});

	it("renders the password reset email with a reset link", async () => {
		const email = await renderPasswordResetEmail({
			resetUrl: "https://eccs.example/reset-password?code=654321",
			expiresInMinutes: 60
		});

		expect(email.html).toContain("Reset password");
		expect(email.html).toContain(
			"https://eccs.example/reset-password?code=654321"
		);
		expect(email.text).toContain("This reset link expires in 60 minutes.");
	});

	it("renders the password changed email with recovery guidance", async () => {
		const email = await renderPasswordChangedEmail({
			forgotPasswordUrl: forgotPasswordUrl("https://eccs.example")
		});

		expect(email.html).toContain("Your password was changed");
		expect(email.html).toContain("https://eccs.example/forgot-password");
		expect(email.text).toContain(
			"If you did not make this change, reset your password immediately"
		);
	});

	it("renders the email change verification email with the new-email link", async () => {
		const email = await renderEmailChangeVerificationEmail({
			verificationUrl:
				"https://eccs.example/verify-email-change?token=new-email",
			expiresInHours: 24
		});

		expect(email.html).toContain("Verify new email");
		expect(email.html).toContain(
			"https://eccs.example/verify-email-change?token=new-email"
		);
		expect(email.text).toContain("Your current login email stays");
		expect(email.text).toContain("active until this verification succeeds.");
	});

	it("builds the inline logo attachment used by transactional emails", () => {
		const attachment = eccsLogoAttachment();

		expect(attachment).toMatchObject({
			contentId: ECCS_LOGO_CONTENT_ID,
			contentType: "image/png",
			filename: "eccs-logo.png"
		});
		expect(Buffer.isBuffer(attachment.content)).toBe(true);
		expect(Buffer.byteLength(attachment.content as Buffer)).toBeGreaterThan(0);
	});
});
