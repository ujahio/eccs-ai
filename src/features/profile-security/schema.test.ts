import { describe, expect, it } from "vitest";
import {
	parseProfileSecurityEmailChangeInput,
	parseProfileSecurityNameInput,
	parseProfileSecurityPasswordChangeInput,
} from "./schema";

describe("profile security schemas", () => {
	it("trims names and composes the display name", () => {
		expect(
			parseProfileSecurityNameInput({
				firstName: " Jordan ",
				lastName: " Adebayo ",
			}),
		).toEqual({
			success: true,
			data: {
				firstName: "Jordan",
				lastName: "Adebayo",
				fullName: "Jordan Adebayo",
			},
		});
	});

	it("validates required name fields", () => {
		expect(
			parseProfileSecurityNameInput({
				firstName: "",
				lastName: "",
			}),
		).toMatchObject({
			success: false,
			fieldErrors: {
				firstName: "Enter your first name.",
				lastName: "Enter your last name.",
			},
		});
	});

	it("normalizes valid pending email addresses", () => {
		expect(
			parseProfileSecurityEmailChangeInput({
				email: " New.Student@Example.COM ",
			}),
		).toEqual({
			success: true,
			data: {
				email: "New.Student@Example.COM",
				emailNormalized: "new.student@example.com",
			},
		});
	});

	it("validates pending email format", () => {
		expect(parseProfileSecurityEmailChangeInput({ email: "nope" })).toMatchObject({
			success: false,
			fieldErrors: {
				email: "Enter a valid email address.",
			},
		});
	});

	it("validates password changes", () => {
		expect(
			parseProfileSecurityPasswordChangeInput({
				currentPassword: "",
				password: "short",
				confirmPassword: "different",
			}),
		).toMatchObject({
			success: false,
			fieldErrors: {
				currentPassword: "Enter your current password.",
				password:
					"Password is missing: at least 8 characters, at least one uppercase letter, at least one number, at least one symbol.",
				confirmPassword: "Passwords do not match.",
			},
			failedPasswordRequirementIds: [
				"minimumLength",
				"uppercase",
				"number",
				"symbol",
			],
		});
	});

	it("rejects reusing the current password", () => {
		expect(
			parseProfileSecurityPasswordChangeInput({
				currentPassword: "Casework1!",
				password: "Casework1!",
				confirmPassword: "Casework1!",
			}),
		).toMatchObject({
			success: false,
			fieldErrors: {
				password: "Choose a new password that is different from the current one.",
			},
		});
	});
});
