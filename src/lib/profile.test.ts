import { describe, it, expect } from "vitest";

import {
  GOAL_LABEL_TR,
  GOAL_OPTIONS,
  ageFrom,
  normalizeUsername,
} from "./profile";

describe("normalizeUsername", () => {
  it("accepts a clean handle", () => {
    expect(normalizeUsername("yasir_23")).toBe("yasir_23");
  });

  it("lowercases and trims before validating", () => {
    expect(normalizeUsername("  YaSiR  ")).toBe("yasir");
  });

  it("maps empty input to null (handle removed)", () => {
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername("   ")).toBeNull();
    expect(normalizeUsername(null)).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
  });

  it("rejects bad characters and lengths as undefined", () => {
    expect(normalizeUsername("ya")).toBeUndefined(); // too short
    expect(normalizeUsername("a".repeat(21))).toBeUndefined(); // too long
    expect(normalizeUsername("yasır")).toBeUndefined(); // non-ascii
    expect(normalizeUsername("ya sir")).toBeUndefined(); // space
    expect(normalizeUsername("ya-sir")).toBeUndefined(); // dash
  });
});

describe("ageFrom", () => {
  const today = new Date("2026-07-02T12:00:00");

  it("computes whole-year age after this year's birthday", () => {
    expect(ageFrom("1998-05-10", today)).toBe(28);
  });

  it("computes whole-year age before this year's birthday", () => {
    expect(ageFrom("1998-12-01", today)).toBe(27);
  });

  it("counts the birthday itself as already turned", () => {
    expect(ageFrom("1998-07-02", today)).toBe(28);
  });

  it("returns null for missing or invalid dates", () => {
    expect(ageFrom(null, today)).toBeNull();
    expect(ageFrom(undefined, today)).toBeNull();
    expect(ageFrom("not-a-date", today)).toBeNull();
  });

  it("rejects out-of-range results", () => {
    expect(ageFrom("2030-01-01", today)).toBeNull(); // negative age
    expect(ageFrom("1800-01-01", today)).toBeNull(); // > 120
  });
});

describe("goal registry", () => {
  it("labels every goal in Turkish", () => {
    for (const g of GOAL_OPTIONS) {
      expect(GOAL_LABEL_TR[g.key]).toBe(g.label);
    }
    expect(GOAL_LABEL_TR.fat_loss).toBe("Yağ kaybı");
  });
});
