import { describe, it, expect } from "vitest";

import { evaluatePR, prFrontier, type PRSet } from "./evaluate-pr";

const h = (weight: number, reps: number, rir: number | null = null): PRSet => ({
  weight,
  reps,
  rir,
});

describe("evaluatePR — Rule A (dominance)", () => {
  it("same weight, more reps => reps PR", () => {
    expect(evaluatePR(h(100, 5), [h(100, 4)]).type).toBe("reps");
  });
  it("same reps, more weight => weight PR", () => {
    expect(evaluatePR(h(102.5, 4), [h(100, 4)]).type).toBe("weight");
  });
  it("both up => both PR", () => {
    expect(evaluatePR(h(105, 5), [h(100, 4)]).type).toBe("both");
  });
  it("identical to history => not PR", () => {
    expect(evaluatePR(h(100, 4), [h(100, 4)]).isPR).toBe(false);
  });
  it("exposes the reference set we beat", () => {
    expect(evaluatePR(h(100, 5), [h(100, 4)]).reference).toMatchObject({
      weight: 100,
      reps: 4,
    });
  });
});

describe("evaluatePR — Rule B (trade-off)", () => {
  it("ref 4 reps: +weight, -1 rep => PR", () => {
    expect(evaluatePR(h(102.5, 3), [h(100, 4)])).toMatchObject({
      isPR: true,
      type: "tradeoff",
    });
  });
  it("ref 4 reps: +weight, -2 reps => not PR", () => {
    expect(evaluatePR(h(102.5, 2), [h(100, 4)]).isPR).toBe(false);
  });
  it("ref 8 reps: must keep >=4; drop to 3 => not PR", () => {
    expect(evaluatePR(h(102.5, 3), [h(100, 8)]).isPR).toBe(false);
  });
  it("ref 8 reps: +weight, drop to 4 => PR", () => {
    expect(evaluatePR(h(102.5, 4), [h(100, 8)])).toMatchObject({
      isPR: true,
      type: "tradeoff",
    });
  });
  it("low-rep (ref 3) trade-off OFF by default", () => {
    expect(evaluatePR(h(110, 2), [h(105, 3)]).isPR).toBe(false);
  });
  it("low-rep trade-off ON via config", () => {
    expect(
      evaluatePR(h(110, 2), [h(105, 3)], { minMaintained: { 3: 2 } }).isPR,
    ).toBe(true);
  });
});

describe("evaluatePR — guards", () => {
  it("weight decreased => never PR", () => {
    expect(evaluatePR(h(95, 6), [h(100, 5)]).isPR).toBe(false);
  });
  it("empty history => not PR (baseline)", () => {
    expect(evaluatePR(h(100, 5), []).isPR).toBe(false);
  });
  it("null weight => not PR", () => {
    expect(
      evaluatePR({ weight: null, reps: 5, rir: null }, [h(100, 4)]).isPR,
    ).toBe(false);
  });
  it("null reps => not PR", () => {
    expect(
      evaluatePR({ weight: 100, reps: null, rir: null }, [h(100, 4)]).isPR,
    ).toBe(false);
  });
});

describe("evaluatePR — RIR PR", () => {
  it("same weight+reps, lower RIR => rir PR", () => {
    expect(evaluatePR(h(100, 5, 1), [h(100, 5, 3)])).toMatchObject({
      isPR: true,
      type: "rir",
    });
  });
  it("RIR equal => not rir PR", () => {
    expect(evaluatePR(h(100, 5, 3), [h(100, 5, 3)]).isPR).toBe(false);
  });
  it("RIR higher => not rir PR", () => {
    expect(evaluatePR(h(100, 5, 4), [h(100, 5, 2)]).isPR).toBe(false);
  });
  it("current RIR present but history RIR null => not rir PR", () => {
    expect(evaluatePR(h(100, 5, 1), [h(100, 5, null)]).isPR).toBe(false);
  });
  it("strength PR takes precedence over rir", () => {
    expect(evaluatePR(h(102.5, 4, 1), [h(100, 4, 3)]).type).toBe("weight");
  });
});

describe("prFrontier", () => {
  it("drops dominated pairs, keeps the non-dominated frontier", () => {
    const f = prFrontier([h(100, 5), h(90, 5), h(100, 4), h(110, 3)]);
    // (90,5) dominated by (100,5); (100,4) dominated by (100,5)
    const pairs = f.map((p) => `${p.weight}x${p.reps}`).sort();
    expect(pairs).toEqual(["100x5", "110x3"]);
  });
  it("keeps the lowest RIR seen for a (weight,reps) pair", () => {
    const f = prFrontier([h(100, 5, 3), h(100, 5, 1)]);
    expect(f).toHaveLength(1);
    expect(f[0].rir).toBe(1);
  });
  it("a frontier feeds evaluatePR identically to full history", () => {
    const history = [h(100, 5), h(90, 5), h(100, 4), h(110, 3)];
    const full = evaluatePR(h(100, 6), history);
    const front = evaluatePR(h(100, 6), prFrontier(history));
    expect(front).toEqual(full);
  });
});
