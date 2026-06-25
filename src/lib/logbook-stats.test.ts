import { describe, it, expect } from "vitest";

import { computeExerciseStats, type HistorySetRow } from "./logbook-stats";

function row(overrides: Partial<HistorySetRow>): HistorySetRow {
  return {
    weight: 60,
    reps: 5,
    rir: null,
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

describe("computeExerciseStats — set-count volume + PR frontier", () => {
  it("volumeSets4w counts sets in the 28-day window (not tonnage)", () => {
    const stats = computeExerciseStats(
      [
        row({ session_date: "2026-06-19", weight: 100, reps: 5 }),
        row({ session_date: "2026-06-12", weight: 80, reps: 8 }),
        row({ session_date: "2026-05-01", weight: 60, reps: 5 }), // outside window
      ],
      "2026-06-19",
    );
    expect(stats.volumeSets4w).toBe(2);
  });

  it("prHistory is the non-dominated frontier across all sets", () => {
    const stats = computeExerciseStats(
      [
        row({ session_date: "2026-06-12", weight: 100, reps: 5 }),
        row({ session_date: "2026-06-12", weight: 90, reps: 5 }), // dominated
        row({ session_date: "2026-06-05", weight: 110, reps: 3 }),
      ],
      "2026-06-19",
    );
    const pairs = stats.prHistory.map((p) => `${p.weight}x${p.reps}`).sort();
    expect(pairs).toEqual(["100x5", "110x3"]);
  });
});
