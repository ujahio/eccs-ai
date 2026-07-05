import { describe, expect, it, vi } from "vitest";
import { isSessionInvalidated } from "./session";
import type { StudentProfileRecord } from "@/features/auth/registration/repository";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
	headers: vi.fn()
}));
vi.mock("next/navigation", () => ({
	redirect: vi.fn()
}));

const profile: StudentProfileRecord = {
	profileId: "profile-1",
	emailNormalized: "student@example.com",
	firstName: "Jordan",
	lastName: "Adebayo",
	fullName: "Jordan Adebayo",
	role: "student",
	emailVerifiedAt: 1,
	canAccessCases: true,
	createdAt: 1,
	updatedAt: 1
};

describe("isSessionInvalidated", () => {
	it("rejects sessions created before the profile invalidation marker", () => {
		expect(
			isSessionInvalidated(
				{ session: { createdAt: new Date("2026-01-01T00:00:00.000Z") } },
				{
					...profile,
					sessionsInvalidatedAt: new Date(
						"2026-01-01T00:01:00.000Z"
					).getTime()
				}
			)
		).toBe(true);
	});

	it("allows sessions created after the profile invalidation marker", () => {
		expect(
			isSessionInvalidated(
				{ session: { createdAt: new Date("2026-01-01T00:02:00.000Z") } },
				{
					...profile,
					sessionsInvalidatedAt: new Date(
						"2026-01-01T00:01:00.000Z"
					).getTime()
				}
			)
		).toBe(false);
	});
});
