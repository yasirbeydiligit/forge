import { describe, expect, it } from "vitest";

import {
  buildTrainingProgress,
  type ProgressSet,
} from "./training-progress";

const WINDOW_START = "2026-04-01";

const CHEST = [{ slug: "gogus", nameTr: "Göğüs" }];
const QUAD = [{ slug: "kuadriseps", nameTr: "Kuadriseps" }];

function set(
  date: string,
  weight: number,
  reps: number,
  overrides: Partial<ProgressSet> = {},
): ProgressSet {
  return {
    date,
    exerciseId: "bench",
    exerciseName: "Bench Press",
    region: "Üst Göğüs",
    muscles: CHEST,
    weight,
    reps,
    rir: null,
    ...overrides,
  };
}

function build(sets: ProgressSet[]) {
  return buildTrainingProgress(sets, WINDOW_START);
}

function exerciseOf(report: ReturnType<typeof build>, id: string) {
  for (const m of report.muscles)
    for (const r of m.regions)
      for (const ex of r.exercises) if (ex.exerciseId === id) return ex;
  return undefined;
}

describe("PR counting & first→last", () => {
  it("counts each strength PR event and reports first→last top sets", () => {
    const report = build([
      set("2026-04-05", 60, 5),
      set("2026-04-12", 62.5, 5), // weight PR
      set("2026-04-19", 65, 5), // weight PR
    ]);
    const ex = exerciseOf(report, "bench")!;
    expect(ex.prCount).toBe(2);
    expect(ex.firstTop).toEqual({ date: "2026-04-05", weight: 60, reps: 5 });
    expect(ex.lastTop).toEqual({ date: "2026-04-19", weight: 65, reps: 5 });
    expect(ex.trend).toBe("up");
    expect(report.totalPRs).toBe(2);
    expect(report.exercisesWithPR).toBe(1);
    expect(report.exercisesTotal).toBe(1);
  });

  it("uses pre-window history so an already-achieved set is no PR", () => {
    const report = build([
      set("2026-03-10", 105, 5), // before window
      set("2026-04-05", 100, 5), // dominated by history → not a PR
    ]);
    const ex = exerciseOf(report, "bench")!;
    expect(ex.prCount).toBe(0);
    // window view starts at the first in-window session
    expect(ex.firstTop.date).toBe("2026-04-05");
  });

  it("does not count RIR-only PRs in the strength PR count", () => {
    const report = build([
      set("2026-04-05", 100, 5, { rir: 2 }),
      set("2026-04-12", 100, 5, { rir: 1 }), // rir PR only
    ]);
    expect(exerciseOf(report, "bench")!.prCount).toBe(0);
  });

  it("takes the heaviest set of a session as its top set", () => {
    const report = build([
      set("2026-04-05", 60, 8),
      set("2026-04-05", 80, 3),
      set("2026-04-12", 82.5, 3),
    ]);
    const ex = exerciseOf(report, "bench")!;
    expect(ex.firstTop).toEqual({ date: "2026-04-05", weight: 80, reps: 3 });
    expect(ex.lastTop.weight).toBe(82.5);
  });
});

describe("trend & anomaly", () => {
  it("flags a sharp drop from the window best as an anomaly", () => {
    const report = build([
      set("2026-04-05", 100, 5),
      set("2026-04-12", 102.5, 5),
      set("2026-04-19", 80, 5), // 22% below best
    ]);
    const ex = exerciseOf(report, "bench")!;
    expect(ex.anomaly).toBe(true);
    expect(ex.trend).toBe("down");
    expect(report.anomalyCount).toBe(1);
  });

  it("tolerates a normal fluctuation", () => {
    const report = build([
      set("2026-04-05", 100, 5),
      set("2026-04-12", 102.5, 5),
      set("2026-04-19", 95, 5), // ~7% below best
    ]);
    expect(exerciseOf(report, "bench")!.anomaly).toBe(false);
  });

  it("needs enough sessions before calling an anomaly", () => {
    const report = build([
      set("2026-04-05", 102.5, 5),
      set("2026-04-19", 80, 5), // only 2 sessions
    ]);
    expect(exerciseOf(report, "bench")!.anomaly).toBe(false);
  });

  it("reads equal weight but more reps as an upward trend", () => {
    const report = build([
      set("2026-04-05", 100, 5),
      set("2026-04-19", 100, 8),
    ]);
    expect(exerciseOf(report, "bench")!.trend).toBe("up");
  });

  it("reports no trend for a single session", () => {
    const report = build([set("2026-04-05", 100, 5)]);
    expect(exerciseOf(report, "bench")!.trend).toBe("none");
  });
});

describe("grouping", () => {
  it("groups muscle → region → exercise and keeps summary counts unique", () => {
    const report = build([
      set("2026-04-05", 100, 5), // bench, Göğüs / Üst Göğüs
      set("2026-04-05", 20, 12, {
        exerciseId: "fly",
        exerciseName: "Cable Fly",
        region: "Orta Göğüs",
      }),
      set("2026-04-06", 140, 5, {
        exerciseId: "squat",
        exerciseName: "Squat",
        region: null,
        muscles: QUAD,
      }),
    ]);
    expect(report.muscles.map((m) => m.muscleSlug).sort()).toEqual([
      "gogus",
      "kuadriseps",
    ]);
    const chest = report.muscles.find((m) => m.muscleSlug === "gogus")!;
    expect(chest.regions.map((r) => r.region).sort()).toEqual([
      "Orta Göğüs",
      "Üst Göğüs",
    ]);
    expect(report.exercisesTotal).toBe(3);
  });

  it("lists a multi-primary exercise under each muscle but counts it once", () => {
    const both = [
      { slug: "gogus", nameTr: "Göğüs" },
      { slug: "on-kol", nameTr: "Ön Kol" },
    ];
    const report = build([
      set("2026-04-05", 60, 5, { muscles: both }),
      set("2026-04-12", 65, 5, { muscles: both }), // 1 PR
    ]);
    expect(report.muscles).toHaveLength(2);
    expect(report.exercisesTotal).toBe(1);
    expect(report.totalPRs).toBe(1);
  });

  it("ignores exercises not trained inside the window", () => {
    const report = build([set("2026-03-10", 100, 5)]);
    expect(report.exercisesTotal).toBe(0);
    expect(report.muscles).toHaveLength(0);
    expect(report.sessionCount).toBe(0);
  });
});
