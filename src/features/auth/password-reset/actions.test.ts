import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	passwordResetConfirmInputFromFormData,
	passwordResetRequestInputFromFormData
} from "./schema";
import { createPasswordResetService } from "./server";
import type {
	PasswordResetConfirmServiceResult,
	PasswordResetRequestServiceResult
} from "./service";
import type {
	PasswordResetConfirmFormState,
	PasswordResetRequestFormState
} from "./state";
import {
	submitPasswordResetConfirmForm,
	submitPasswordResetRequestForm
} from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new Error(`NEXT_REDIRECT:${url}`);
	})
}));
vi.mock("./server", () => ({
	createPasswordResetService: vi.fn()
}));
vi.mock("./schema", () => ({
	passwordResetConfirmInputFromFormData: vi.fn(),
	passwordResetRequestInputFromFormData: vi.fn()
}));

const mockedCreatePasswordResetService = vi.mocked(createPasswordResetService);
const mockedPasswordResetRequestInputFromFormData = vi.mocked(
	passwordResetRequestInputFromFormData
);
const mockedPasswordResetConfirmInputFromFormData = vi.mocked(
	passwordResetConfirmInputFromFormData
);
const mockedRedirect = vi.mocked(redirect);

const parsedRequestInput = {
	email: "jordan@example.com"
};

const parsedConfirmInput = {
	email: "jordan@example.com",
	code: "123456",
	password: "Newcase1!",
	confirmPassword: "Newcase1!"
};

const previousRequestState: PasswordResetRequestFormState = {
	status: "idle",
	message: "",
	values: { email: "" },
	errors: {}
};

const previousConfirmState: PasswordResetConfirmFormState = {
	status: "idle",
	message: "",
	values: {
		email: "",
		code: "",
		password: "",
		confirmPassword: ""
	},
	errors: {}
};

function stubRequestService(result: PasswordResetRequestServiceResult) {
	mockedCreatePasswordResetService.mockReturnValue({
		requestPasswordReset: vi.fn().mockResolvedValue(result)
	} as never);
	mockedPasswordResetRequestInputFromFormData.mockReturnValue(
		parsedRequestInput
	);
}

function stubConfirmService(result: PasswordResetConfirmServiceResult) {
	mockedCreatePasswordResetService.mockReturnValue({
		confirmPasswordReset: vi.fn().mockResolvedValue(result)
	} as never);
	mockedPasswordResetConfirmInputFromFormData.mockReturnValue(
		parsedConfirmInput
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("submitPasswordResetRequestForm", () => {
	it("keeps delivery-unavailable responses non-enumerating in the UI state", async () => {
		const message =
			"If this account exists and has a verified email, a reset link has been sent. If you do not receive one, verify your email or contact support.";

		stubRequestService({
			status: "delivery_unavailable",
			message
		});

		const result = await submitPasswordResetRequestForm(
			previousRequestState,
			new FormData()
		);

		expect(result).toEqual({
			status: "success",
			message,
			values: {
				email: "jordan@example.com"
			},
			errors: {}
		});
	});
});

describe("submitPasswordResetConfirmForm", () => {
	it("redirects invalid, expired, or used reset codes to request a new link", async () => {
		stubConfirmService({
			status: "invalid_code",
			message:
				"This reset link is invalid, expired, or already used. Request a new reset link."
		});

		await expect(
			submitPasswordResetConfirmForm(previousConfirmState, new FormData())
		).rejects.toThrow("NEXT_REDIRECT:/forgot-password?reset=invalid");
		expect(mockedRedirect).toHaveBeenCalledWith(
			"/forgot-password?reset=invalid"
		);
	});

	it("redirects successful resets to login for reauthentication", async () => {
		stubConfirmService({
			status: "password_reset",
			message: "Your password was changed. Please sign in."
		});

		await expect(
			submitPasswordResetConfirmForm(previousConfirmState, new FormData())
		).rejects.toThrow("NEXT_REDIRECT:/login?reset=changed");
		expect(mockedRedirect).toHaveBeenCalledWith("/login?reset=changed");
	});
});
