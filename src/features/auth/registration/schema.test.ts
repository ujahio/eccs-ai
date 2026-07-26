import { describe, expect, it } from "vitest";
import {
	failedPasswordRequirements,
	parseRegistrationInput
} from "./schema";

const validInput = {
	firstName: "Jordan",
	lastName: "Adebayo",
	email: "jordan@example.com",
	password: "Casework1!"
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
					"Password is missing: at least one lowercase letter, at least one number, at least one symbol."
			}
		});
	});

	it("matches the permanent account password policy", () => {
		expect(failedPasswordRequirements("Casework1!")).toEqual([]);
		expect(failedPasswordRequirements("casework1").map(({ id }) => id)).toEqual([
			"uppercase",
			"symbol"
		]);
		expect(failedPasswordRequirements("CASEWORK1!").map(({ id }) => id)).toEqual([
			"lowercase"
		]);
		expect(failedPasswordRequirements("Casework!").map(({ id }) => id)).toEqual([
			"number"
		]);
		expect(failedPasswordRequirements("Casework1").map(({ id }) => id)).toEqual([
			"symbol"
		]);
		expect(failedPasswordRequirements("Case1!").map(({ id }) => id)).toEqual([
			"minimumLength"
		]);
	});
});
