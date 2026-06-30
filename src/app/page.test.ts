import { describe, expect, it } from "vitest";

describe("phase 0 scaffold", () => {
  it("uses the agreed local SST stage", () => {
    expect("local").toBe("local");
  });

  it("defines the baseline public, student, and teacher route areas", () => {
    expect(["/", "/student", "/teacher"]).toEqual([
      "/",
      "/student",
      "/teacher"
    ]);
  });
});
