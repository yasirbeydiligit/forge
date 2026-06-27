import { describe, it, expect } from "vitest";

import { buildCoachWeekly, type CoachWeekSet } from "./coach-weekly";
import type { TargetRef } from "./session-report";

function target(muscleSlug: string, fn: string, role: "primary" | "secondary"): TargetRef {
  return {
    muscleSlug,
    muscleNameTr: muscleSlug,
    functionSlug: fn,
    functionNameTr: fn,
    role,
  };
}

function set(o: Partial<CoachWeekSet> = {}): CoachWeekSet {
  return {
    sessionId: "s1",
    sessionDate: "2026-06-22",
    exerciseId: "squat",
    exerciseName: "Squat",
    weight: 100,
    reps: 5,
    rir: 2,
    region: null,
    performedAt: "2026-06-22T10:00:00.000Z",
    createdAt: "2026-06-22T10:00:00.000Z",
    targets: [target("quads", "quads-knee-extension", "primary")],
    ...o,
  };
}

describe("buildCoachWeekly — region breakdown", () => {
  it("breaks a muscle's primary sets down by exercise region", () => {
    const chest = (s: Partial<CoachWeekSet>) =>
      set({ targets: [target("chest", "chest-horizontal-adduction", "primary")], ...s });
    const report = buildCoachWeekly([
      chest({ exerciseId: "incline", exerciseName: "Incline", region: "Üst Göğüs" }),
      chest({ exerciseId: "incline", exerciseName: "Incline", region: "Üst Göğüs" }),
      chest({ exerciseId: "pecdeck", exerciseName: "Pec Deck", region: "Orta Göğüs" }),
    ]);
    const m = report.muscles.find((x) => x.muscleSlug === "chest")!;
    expect(m.regions).toEqual([
      { region: "Üst Göğüs", primarySets: 2 },
      { region: "Orta Göğüs", primarySets: 1 },
    ]);
  });
});

describe("buildCoachWeekly — muscle grouping", () => {
  it("groups sets per muscle and lists the exercises that trained it", () => {
    const report = buildCoachWeekly([
      set(),
      set({ performedAt: "2026-06-22T10:03:00.000Z" }),
      set({
        exerciseId: "bench",
        exerciseName: "Bench",
        targets: [target("chest", "chest-horizontal-adduction", "primary")],
        performedAt: "2026-06-22T10:10:00.000Z",
      }),
    ]);
    expect(report.totalSets).toBe(3);
    const quads = report.muscles.find((m) => m.muscleSlug === "quads")!;
    expect(quads.primarySets).toBe(2);
    expect(quads.exercises.map((e) => e.exerciseName)).toEqual(["Squat"]);
    expect(quads.exercises[0].sets).toBe(2);
  });

  it("aggregates two different exercises that share a muscle", () => {
    const report = buildCoachWeekly([
      set(),
      set({
        exerciseId: "legpress",
        exerciseName: "Leg Press",
        targets: [target("quads", "quads-knee-extension", "primary")],
      }),
    ]);
    const quads = report.muscles.find((m) => m.muscleSlug === "quads")!;
    expect(quads.primarySets).toBe(2);
    expect(quads.exercises).toHaveLength(2);
  });
});

describe("buildCoachWeekly — order performed", () => {
  it("reports the 1-based order of an exercise within its session", () => {
    const report = buildCoachWeekly([
      set({ exerciseId: "squat", exerciseName: "Squat", performedAt: "2026-06-22T10:00:00.000Z" }),
      set({
        exerciseId: "bench",
        exerciseName: "Bench",
        targets: [target("chest", "chest-horizontal-adduction", "primary")],
        performedAt: "2026-06-22T10:10:00.000Z",
      }),
    ]);
    const quads = report.muscles.find((m) => m.muscleSlug === "quads")!;
    expect(quads.exercises[0].avgOrder).toBe(1);
    const chest = report.muscles.find((m) => m.muscleSlug === "chest")!;
    expect(chest.exercises[0].avgOrder).toBe(2);
  });
});

describe("buildCoachWeekly — rest + RIR", () => {
  it("computes median rest from consecutive same-exercise gaps", () => {
    const report = buildCoachWeekly([
      set({ performedAt: "2026-06-22T10:00:00.000Z" }),
      set({ performedAt: "2026-06-22T10:03:00.000Z" }), // 180s gap
      set({ performedAt: "2026-06-22T10:05:00.000Z" }), // 120s gap
    ]);
    const quads = report.muscles.find((m) => m.muscleSlug === "quads")!;
    expect(quads.exercises[0].restMedianSec).toBe(150); // median of [180,120]
  });

  it("averages RIR per exercise", () => {
    const report = buildCoachWeekly([
      set({ rir: 2 }),
      set({ rir: 3, performedAt: "2026-06-22T10:03:00.000Z" }),
    ]);
    const quads = report.muscles.find((m) => m.muscleSlug === "quads")!;
    expect(quads.exercises[0].avgRir).toBe(2.5);
  });

  it("rest is null with a single set", () => {
    const report = buildCoachWeekly([set()]);
    const quads = report.muscles.find((m) => m.muscleSlug === "quads")!;
    expect(quads.exercises[0].restMedianSec).toBeNull();
  });
});
