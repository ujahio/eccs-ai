import { describe, expect, it } from "vitest";
import {
	parseStudentEmailChangeInput,
	parseStudentNameInput,
	parseStudentPasswordChangeInput,
} from "./schema";

describe("student profile security schemas", () => {
	it("trims names and composes the display name", () => {
		expect(
			parseStudentNameInput({
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
			parseStudentNameInput({
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
			parseStudentEmailChangeInput({
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
		expect(parseStudentEmailChangeInput({ email: "nope" })).toMatchObject({
			success: false,
			fieldErrors: {
				email: "Enter a valid email address.",
			},
		});
	});

	it("validates password changes", () => {
		expect(
			parseStudentPasswordChangeInput({
				currentPassword: "",
				password: "short",
				confirmPassword: "different",
			}),
		).toMatchObject({
			success: false,
			fieldErrors: {
				currentPassword: "Enter your current password.",
				password:
					"Password is missing: at least 8 characters, at least one number.",
				confirmPassword: "Passwords do not match.",
			},
			failedPasswordRequirementIds: ["minimumLength", "number"],
		});
	});

	it("rejects reusing the current password", () => {
		expect(
			parseStudentPasswordChangeInput({
				currentPassword: "casework1",
				password: "casework1",
				confirmPassword: "casework1",
			}),
		).toMatchObject({
			success: false,
			fieldErrors: {
				password: "Choose a new password that is different from the current one.",
			},
		});
	});
});
