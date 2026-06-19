import { describe, it, expect } from "vitest";

import { computeExerciseStats, type HistorySetRow } from "./logbook-stats";

function row(overrides: Partial<HistorySetRow>): HistorySetRow {
  return {
    weight: 60,
    reps: 5,
    rpe: null,
    set_number: 1,
    exercise_id: "e1",
    created_at: "2026-06-12T10:00:00Z",
    session_date: "2026-06-12",
    ...overrides,
  };
}

describe("computeExerciseStats.prevSessionSets", () => {
  it("returns the previous session's sets ordered by set number, with reps", () => {
    const stats = computeExerciseStats(
      [
        row({ session_date: "2026-06-12", set_number: 2, weight: 60, reps: 8 }),
        row({ session_date: "2026-06-12", set_number: 1, weight: 60, reps: 5 }),
        row({ session_date: "2026-06-05", set_number: 1, weight: 55, reps: 5 }),
      ],
      "2026-06-19",
    );
    expect(stats.prevSessionSets).toEqual([
      { weight: 60, reps: 5 },
      { weight: 60, reps: 8 },
    ]);
    // prevSessionWeights stays consistent with prevSessionSets
    expect(stats.prevSessionWeights).toEqual([60, 60]);
  });

  it("excludes the day being trained (today's sets are not 'previous')", () => {
    const stats = computeExerciseStats(
      [
        row({ session_date: "2026-06-19", set_number: 1, weight: 70, reps: 3 }),
        row({ session_date: "2026-06-12", set_number: 1, weight: 60, reps: 5 }),
      ],
      "2026-06-19",
    );
    expect(stats.prevSessionSets).toEqual([{ weight: 60, reps: 5 }]);
  });

  it("is empty when there is no prior session", () => {
    const stats = computeExerciseStats(
      [row({ session_date: "2026-06-19", set_number: 1 })],
      "2026-06-19",
    );
    expect(stats.prevSessionSets).toEqual([]);
  });
});
