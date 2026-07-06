import { describe, expect, it } from "vitest";
import {
	addNotification,
	createNotification,
	notificationAutoDismissMs,
	removeNotification,
	removeNotificationsByKey,
} from "./notifications";

describe("notification policy", () => {
	it("auto-dismisses success and info notifications by default", () => {
		expect(notificationAutoDismissMs({ tone: "success" })).toBe(5000);
		expect(notificationAutoDismissMs({ tone: "info" })).toBe(5000);
	});

	it("keeps warning and error notifications until dismissal by default", () => {
		expect(notificationAutoDismissMs({ tone: "warning" })).toBe(false);
		expect(notificationAutoDismissMs({ tone: "error" })).toBe(false);
	});

	it("honors explicit auto-dismiss overrides", () => {
		expect(
			notificationAutoDismissMs({ tone: "success", autoDismissMs: false }),
		).toBe(false);
		expect(
			notificationAutoDismissMs({ tone: "info", autoDismissMs: 3000 }),
		).toBe(3000);
	});

	it("does not auto-dismiss warning or error notifications even with overrides", () => {
		expect(
			notificationAutoDismissMs({ tone: "warning", autoDismissMs: 3000 }),
		).toBe(false);
		expect(
			notificationAutoDismissMs({ tone: "error", autoDismissMs: 3000 }),
		).toBe(false);
	});

	it("replaces notifications with the same dedupe key", () => {
		const first = createNotification(
			{ tone: "success", message: "Saved.", dedupeKey: "profile" },
			"first",
		);
		const second = createNotification(
			{ tone: "error", message: "Try again.", dedupeKey: "profile" },
			"second",
		);

		expect(addNotification([first], second)).toEqual([second]);
	});

	it("dismisses by id or dedupe key", () => {
		const first = createNotification(
			{ tone: "success", message: "Saved.", dedupeKey: "profile" },
			"first",
		);
		const second = createNotification(
			{ tone: "warning", message: "Verify email.", dedupeKey: "email" },
			"second",
		);

		expect(removeNotification([first, second], "first")).toEqual([second]);
		expect(removeNotificationsByKey([first, second], "email")).toEqual([
			first,
		]);
	});
});
