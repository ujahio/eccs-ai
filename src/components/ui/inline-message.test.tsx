import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldError, InlineMessage } from "./inline-message";

describe("InlineMessage", () => {
	it("renders accessible alert/status attributes", () => {
		const markup = renderToStaticMarkup(
			<InlineMessage role="alert" testId="email-error" tone="error">
				Fix the email address.
			</InlineMessage>,
		);

		expect(markup).toContain('aria-live="polite"');
		expect(markup).toContain('data-testid="email-error"');
		expect(markup).toContain('role="alert"');
		expect(markup).toContain("Fix the email address.");
	});
});

describe("FieldError", () => {
	it("renders field error ids and test selectors", () => {
		const markup = renderToStaticMarkup(
			<FieldError id="password-error" testId="password-error">
				Enter your password.
			</FieldError>,
		);

		expect(markup).toContain('data-testid="password-error"');
		expect(markup).toContain('id="password-error"');
		expect(markup).toContain("Enter your password.");
	});
});
