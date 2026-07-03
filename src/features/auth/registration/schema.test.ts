import { describe, expect, it } from "vitest";
import {
	failedPasswordRequirements,
	parseRegistrationInput
} from "./schema";

const validInput = {
	firstName: "Jordan",
	lastName: "Adebayo",
	email: "jordan@example.com",
	password: "casework1"
};

describe("registration schema", () => {
	it("reports each missing password requirement", () => {
		const result = parseRegistrationInput({
			...validInput,
			password: "PASSWORD"
		});

		expect(result).toEqual({
			success: false,
			fieldErrors: {
				password:
					"Password is missing: at least one lowercase letter, at least one number."
			}
		});
	});

	it("matches the Cognito password policy", () => {
		expect(failedPasswordRequirements("casework1")).toEqual([]);
		expect(failedPasswordRequirements("CASEWORK1").map(({ id }) => id)).toEqual([
			"lowercase"
		]);
		expect(failedPasswordRequirements("casework").map(({ id }) => id)).toEqual([
			"number"
		]);
		expect(failedPasswordRequirements("case1").map(({ id }) => id)).toEqual([
			"minimumLength"
		]);
	});
});
