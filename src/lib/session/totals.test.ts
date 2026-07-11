import { describe, it, expect } from "vitest";

import { detectPr, detectPrResult, sessionTotals } from "./totals";
import type { ExerciseState, SetEntry } from "./types";

function set(overrides: Partial<SetEntry> = {}): SetEntry {
  return {
    localId: "l",
    serverId: null,
    weight: 100,
    reps: 5,
    rir: null,
    note: null,
    completedAt: 0,
    pr: false,
    ...overrides,
  };
}

describe("detectPr (evaluatePR wrapper)", () => {
  const history = [{ weight: 100, reps: 5, rir: null }];

  it("flags more reps at the same weight", () => {
    expect(detectPr(history, { weight: 100, reps: 6, rir: null })).toBe(true);
  });

  it("flags a Rule B trade-off (heavier, one fewer rep)", () => {
    expect(
      detectPr([{ weight: 100, reps: 4, rir: null }], { weight: 102.5, reps: 3, rir: null }),
    ).toBe(true);
  });

  it("does not flag matching or lighter work", () => {
    expect(detectPr(history, { weight: 100, reps: 5, rir: null })).toBe(false);
    expect(detectPr(history, { weight: 90, reps: 5, rir: null })).toBe(false);
  });

  it("does not flag the first-ever set (no prior history)", () => {
    expect(detectPr([], { weight: 60, reps: 5, rir: null })).toBe(false);
  });

  it("does not flag when weight or reps are missing", () => {
    expect(detectPr(history, { weight: null, reps: 5, rir: null })).toBe(false);
    expect(detectPr(history, { weight: 120, reps: null, rir: null })).toBe(false);
  });

  it("flags a RIR PR (same weight+reps, lower RIR)", () => {
    expect(
      detectPr([{ weight: 100, reps: 5, rir: 3 }], { weight: 100, reps: 5, rir: 1 }),
    ).toBe(true);
  });
});

describe("detectPrResult", () => {
  it("exposes the PR type for celebration copy (weight PR)", () => {
    const r = detectPrResult([{ weight: 100, reps: 5, rir: null }], {
      weight: 102.5,
      reps: 5,
      rir: null,
    });
    expect(r.isPR).toBe(true);
    expect(r.type).toBe("weight");
  });

  it("labels a RIR PR distinctly from strength PRs", () => {
    const r = detectPrResult([{ weight: 100, reps: 5, rir: 3 }], {
      weight: 100,
      reps: 5,
      rir: 1,
    });
    expect(r.isPR).toBe(true);
    expect(r.type).toBe("rir");
  });

  it("returns a null type when not a PR", () => {
    const r = detectPrResult([{ weight: 100, reps: 5, rir: null }], {
      weight: 90,
      reps: 5,
      rir: null,
    });
    expect(r).toMatchObject({ isPR: false, type: null });
  });
});

describe("sessionTotals", () => {
  it("counts sets and PRs across exercises (volume is set count, not tonnage)", () => {
    const exercises: ExerciseState[] = [
      {
        workoutExerciseId: "we1",
        exerciseId: "e1",
        sets: [set({ pr: true }), set()],
      },
      {
        workoutExerciseId: "we2",
        exerciseId: "e2",
        sets: [set({ weight: 50, reps: 10 })],
      },
    ];
    expect(sessionTotals(exercises)).toEqual({ setCount: 3, prCount: 1 });
  });

  it("counts every completed set regardless of missing weight/reps", () => {
    const exercises: ExerciseState[] = [
      {
        workoutExerciseId: "we1",
        exerciseId: "e1",
        sets: [set({ weight: null }), set({ reps: null }), set()],
      },
    ];
    expect(sessionTotals(exercises)).toEqual({ setCount: 3, prCount: 0 });
  });
});
