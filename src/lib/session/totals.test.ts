import { describe, it, expect } from "vitest";

import { detectPr, sessionTotals } from "./totals";
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

describe("detectPr", () => {
  const stats = { allTimePr: 100, bestEst1RM: 112.5, prevSessionWeights: [] };

  it("flags a heavier top-set than the all-time weight PR", () => {
    expect(detectPr(stats, { weight: 102.5, reps: 3 })).toBe(true);
  });

  it("flags a set whose estimated 1RM beats the best, even at lower weight", () => {
    // 95 x 6 -> Brzycki ~110.3, below 112.5; 95 x 8 -> ~117.9, beats it.
    expect(detectPr(stats, { weight: 95, reps: 8 })).toBe(true);
    expect(detectPr(stats, { weight: 95, reps: 6 })).toBe(false);
  });

  it("does not flag matching or lighter work", () => {
    expect(detectPr(stats, { weight: 100, reps: 5 })).toBe(false);
    expect(detectPr(stats, { weight: 90, reps: 5 })).toBe(false);
  });

  it("does not flag when weight or reps are missing", () => {
    expect(detectPr(stats, { weight: null, reps: 5 })).toBe(false);
    expect(detectPr(stats, { weight: 120, reps: null })).toBe(false);
  });

  it("does not flag the first-ever set (no prior history)", () => {
    expect(
      detectPr({ allTimePr: null, bestEst1RM: null }, { weight: 60, reps: 5 }),
    ).toBe(false);
  });
});

describe("sessionTotals", () => {
  it("sums volume, counts sets and PRs across exercises", () => {
    const exercises: ExerciseState[] = [
      {
        workoutExerciseId: "we1",
        exerciseId: "e1",
        sets: [set({ weight: 100, reps: 5, pr: true }), set({ weight: 100, reps: 5 })],
      },
      {
        workoutExerciseId: "we2",
        exerciseId: "e2",
        sets: [set({ weight: 50, reps: 10 })],
      },
    ];
    expect(sessionTotals(exercises)).toEqual({
      setCount: 3,
      volume: 100 * 5 + 100 * 5 + 50 * 10,
      prCount: 1,
    });
  });

  it("ignores sets missing weight or reps in the volume", () => {
    const exercises: ExerciseState[] = [
      {
        workoutExerciseId: "we1",
        exerciseId: "e1",
        sets: [set({ weight: null, reps: 5 }), set({ weight: 80, reps: null }), set({ weight: 80, reps: 3 })],
      },
    ];
    expect(sessionTotals(exercises)).toMatchObject({ setCount: 3, volume: 240 });
  });
});
