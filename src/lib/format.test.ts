import { describe, it, expect } from "vitest";

import { getInitials } from "./format";

describe("getInitials", () => {
  it("takes up to two uppercase initials", () => {
    expect(getInitials("ahmet yasir beydili")).toBe("AY");
  });
  it("handles a single name", () => {
    expect(getInitials("Forge")).toBe("F");
  });
  it("collapses extra spaces", () => {
    expect(getInitials("  john   doe ")).toBe("JD");
  });
  it("returns empty string for empty input", () => {
    expect(getInitials("")).toBe("");
  });
});
