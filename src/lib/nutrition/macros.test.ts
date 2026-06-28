import { describe, expect, it } from "vitest";

import { computeKcal, kcalMismatch, scaleMacros } from "./macros";

describe("computeKcal", () => {
  it("uses the 4/4/9 Atwater factors", () => {
    expect(computeKcal(40, 60, 20)).toBe(40 * 4 + 60 * 4 + 20 * 9); // 580
  });

  it("treats null/undefined macros as 0", () => {
    expect(computeKcal(null, null, null)).toBe(0);
    expect(computeKcal(30, undefined, 10)).toBe(30 * 4 + 10 * 9); // 210
  });

  it("rounds to a whole number", () => {
    expect(computeKcal(10.4, 0, 0)).toBe(42); // 41.6 -> 42
  });
});

describe("kcalMismatch", () => {
  it("is null when there is no manual kcal to compare", () => {
    expect(kcalMismatch(null, 40, 60, 20)).toBeNull();
  });

  it("is null when macros give no estimate (all zero)", () => {
    expect(kcalMismatch(580, 0, 0, 0)).toBeNull();
  });

  it("is false within the default 10% tolerance", () => {
    expect(kcalMismatch(580, 40, 60, 20)).toBe(false); // exact
    expect(kcalMismatch(610, 40, 60, 20)).toBe(false); // ~5% over
  });

  it("is true beyond the tolerance", () => {
    expect(kcalMismatch(700, 40, 60, 20)).toBe(true); // ~21% over
    expect(kcalMismatch(400, 40, 60, 20)).toBe(true); // ~31% under
  });

  it("honours a custom tolerance", () => {
    expect(kcalMismatch(640, 40, 60, 20, 0.2)).toBe(false); // ~10% over, tol 20%
  });
});

describe("scaleMacros", () => {
  it("scales and rounds every numeric field", () => {
    expect(
      scaleMacros({ kcal: 580, protein: 40, carbs: 60, fat: 20 }, 1.5),
    ).toEqual({ kcal: 870, protein: 60, carbs: 90, fat: 30 });
  });

  it("keeps null fields null", () => {
    expect(
      scaleMacros({ kcal: null, protein: 40, carbs: null, fat: null }, 2),
    ).toEqual({ kcal: null, protein: 80, carbs: null, fat: null });
  });
});
