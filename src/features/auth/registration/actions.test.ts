import { describe, expect, it, vi } from "vitest";
import { createRegistrationService } from "./server";
import { registrationInputFromFormData } from "./schema";
import type { RegistrationServiceResult } from "./service";
import type { RegistrationFormState } from "./state";
import { submitRegistrationForm } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({
	createRegistrationService: vi.fn()
}));
vi.mock("./schema", () => ({
	registrationInputFromFormData: vi.fn()
}));

const mockedCreateRegistrationService = vi.mocked(createRegistrationService);
const mockedRegistrationInputFromFormData = vi.mocked(
	registrationInputFromFormData
);

const parsedInput = {
	firstName: "Jordan",
	lastName: "Adebayo",
	email: "jordan@example.com",
	password: "casework1"
};

const previousState: RegistrationFormState = {
	status: "idle",
	message: "",
	values: { firstName: "", lastName: "", email: "", password: "" },
	errors: {}
};

function stubService(result: RegistrationServiceResult) {
	mockedCreateRegistrationService.mockReturnValue({
		registerStudent: vi.fn().mockResolvedValue(result)
	} as never);
	mockedRegistrationInputFromFormData.mockReturnValue(parsedInput);
}

describe("submitRegistrationForm", () => {
	it("returns success state when verification is sent", async () => {
		stubService({
			status: "verification_sent",
			message: "Check your email."
		});

		const result = await submitRegistrationForm(
			previousState,
			new FormData()
		);

		expect(result).toEqual({
			status: "success",
			message: "Check your email.",
			values: {
				firstName: "",
				lastName: "",
				email: "jordan@example.com",
				password: ""
			},
			errors: {}
		});
	});

	it("returns error state with mapped field errors on validation failure", async () => {
		stubService({
			status: "validation_error",
			message: "Fix the errors below.",
			fieldErrors: {
				firstName: "First name is required.",
				email: "Invalid email."
			}
		});

		const result = await submitRegistrationForm(
			previousState,
			new FormData()
		);

		expect(result).toEqual({
			status: "error",
			message: "Fix the errors below.",
		values: {
			firstName: "Jordan",
			lastName: "Adebayo",
			email: "jordan@example.com",
			password: ""
		},
		errors: {
			firstName: ["First name is required."],
			email: ["Invalid email."]
		}
	});
	});

	it("returns notice state when resend is blocked", async () => {
		stubService({
			status: "resend_blocked",
			message: "Maximum requests reached."
		});

		const result = await submitRegistrationForm(
			previousState,
			new FormData()
		);

		expect(result).toEqual({
			status: "notice",
			message: "Maximum requests reached.",
			values: {
				firstName: "Jordan",
				lastName: "Adebayo",
				email: "jordan@example.com",
				password: ""
			},
			errors: {}
		});
	});

	it("returns error state when account already exists", async () => {
		stubService({
			status: "account_exists",
			message: "An account with this email already exists."
		});

		const result = await submitRegistrationForm(
			previousState,
			new FormData()
		);

		expect(result).toEqual({
			status: "error",
			message: "An account with this email already exists.",
			values: {
				firstName: "Jordan",
				lastName: "Adebayo",
				email: "jordan@example.com",
				password: ""
			},
			errors: {}
		});
	});

	it("clears password from returned values", async () => {
		stubService({
			status: "verification_sent",
			message: "Done."
		});

		const result = await submitRegistrationForm(
			previousState,
			new FormData()
		);

		expect(result.values.password).toBe("");
	});

	it("filters out undefined field errors", async () => {
		stubService({
			status: "validation_error",
			message: "Fix errors.",
			fieldErrors: {
				firstName: "Required.",
				lastName: undefined,
				email: undefined,
				password: "Too short."
			}
		});

		const result = await submitRegistrationForm(
			previousState,
			new FormData()
		);

		expect(result.errors).toEqual({
			firstName: ["Required."],
			password: ["Too short."]
		});
	});
});
