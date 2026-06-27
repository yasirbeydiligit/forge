import { describe, it, expect } from "vitest";

import { buildSessionReport, type ReportSet } from "./session-report";

/** Chest-primary, triceps-secondary press target set. */
function pressTargets(): ReportSet["targets"] {
  return [
    {
      muscleSlug: "chest",
      muscleNameTr: "Göğüs",
      functionSlug: "chest-horizontal-adduction",
      functionNameTr: "Yatay addüksiyon",
      role: "primary",
    },
    {
      muscleSlug: "triceps",
      muscleNameTr: "Triceps",
      functionSlug: "triceps-elbow-extension",
      functionNameTr: "Dirsek ekstansiyonu",
      role: "secondary",
    },
  ];
}

function set(o: Partial<ReportSet> = {}): ReportSet {
  return {
    exerciseId: "bench",
    exerciseName: "Bench Press",
    weight: 100,
    reps: 5,
    rir: null,
    region: null,
    category: null,
    note: null,
    performedAt: "2026-06-25T10:00:00.000Z",
    createdAt: "2026-06-25T10:00:00.000Z",
    targets: pressTargets(),
    ...o,
  };
}

const noHistory = {};

describe("buildSessionReport — region sub-breakdown", () => {
  it("breaks a muscle's primary sets down by exercise region", () => {
    const report = buildSessionReport({
      sets: [
        set({ exerciseId: "incline", region: "Üst Göğüs" }),
        set({ exerciseId: "incline", region: "Üst Göğüs" }),
        set({ exerciseId: "incline", region: "Üst Göğüs" }),
        set({ exerciseId: "pecdeck", region: "Orta Göğüs" }),
        set({ exerciseId: "pecdeck", region: "Orta Göğüs" }),
        set({ exerciseId: "pullover", region: "Alt Göğüs" }),
        set({ exerciseId: "pullover", region: "Alt Göğüs" }),
      ],
      histories: noHistory,
    });
    const chest = report.muscles.find((m) => m.muscleSlug === "chest")!;
    expect(chest.primarySets).toBe(7);
    expect(chest.regions).toEqual([
      { region: "Üst Göğüs", primarySets: 3 },
      { region: "Orta Göğüs", primarySets: 2 },
      { region: "Alt Göğüs", primarySets: 2 },
    ]);
  });

  it("does not attribute a primary exercise's region to a secondary muscle", () => {
    // Bench is chest-primary, triceps-secondary, region 'Orta Göğüs'.
    const report = buildSessionReport({
      sets: [set({ region: "Orta Göğüs" }), set({ region: "Orta Göğüs" })],
      histories: noHistory,
    });
    const triceps = report.muscles.find((m) => m.muscleSlug === "triceps")!;
    expect(triceps.regions).toEqual([]);
  });

  it("leaves regions empty when no set has a region", () => {
    const report = buildSessionReport({ sets: [set(), set()], histories: noHistory });
    const chest = report.muscles.find((m) => m.muscleSlug === "chest")!;
    expect(chest.regions).toEqual([]);
  });
});

describe("buildSessionReport — PR grouping by region/category", () => {
  it("groups strength PRs by region, falling back to category", () => {
    const report = buildSessionReport({
      sets: [
        set({ exerciseId: "incline", region: "Üst Göğüs", category: "Göğüs", weight: 105, reps: 5 }),
        set({ exerciseId: "ohp", region: null, category: "Omuz", weight: 60, reps: 5, targets: [
          { muscleSlug: "front-delt", muscleNameTr: "Ön omuz", functionSlug: "fd", functionNameTr: "Omuz fleksiyonu", role: "primary" },
        ] }),
      ],
      histories: {
        incline: { prHistory: [{ weight: 100, reps: 5, rir: null }], prevSessionSets: [{ weight: 100, reps: 5, rir: null }] },
        ohp: { prHistory: [{ weight: 55, reps: 5, rir: null }], prevSessionSets: [{ weight: 55, reps: 5, rir: null }] },
      },
    });
    expect(report.prCount).toBe(2);
    expect(report.prGroups).toEqual([
      { label: "Üst Göğüs", kind: "region", count: 1 },
      { label: "Omuz", kind: "category", count: 1 },
    ]);
  });
});

describe("buildSessionReport — per-set notes", () => {
  it("carries each set's note into the movement summary", () => {
    const report = buildSessionReport({
      sets: [set({ note: "sağ omuz hafif ağrı" }), set({ note: null })],
      histories: noHistory,
    });
    expect(report.exercises[0].sets.map((s) => s.note)).toEqual(["sağ omuz hafif ağrı", null]);
  });
});

describe("buildSessionReport — muscle/function distribution", () => {
  it("counts primary and secondary sets per muscle and per function", () => {
    const report = buildSessionReport({
      sets: [set(), set(), set()],
      histories: noHistory,
    });
    expect(report.totalSets).toBe(3);
    const chest = report.muscles.find((m) => m.muscleSlug === "chest")!;
    expect(chest.primarySets).toBe(3);
    expect(chest.secondarySets).toBe(0);
    expect(chest.functions[0]).toMatchObject({
      functionSlug: "chest-horizontal-adduction",
      primarySets: 3,
    });
    const triceps = report.muscles.find((m) => m.muscleSlug === "triceps")!;
    expect(triceps.secondarySets).toBe(3);
    expect(triceps.primarySets).toBe(0);
  });

  it("counts a set once per muscle even when it hits two of the muscle's functions", () => {
    // A leg exercise targeting hamstrings via BOTH knee-flexion and hip-extension:
    // 1 set = 1 set for the hamstrings muscle, but 1 set for each function.
    const hamTargets: ReportSet["targets"] = [
      {
        muscleSlug: "hamstrings",
        muscleNameTr: "Arka bacak",
        functionSlug: "hamstrings-knee-flexion",
        functionNameTr: "Diz fleksiyonu",
        role: "primary",
      },
      {
        muscleSlug: "hamstrings",
        muscleNameTr: "Arka bacak",
        functionSlug: "hamstrings-hip-extension",
        functionNameTr: "Kalça ekstansiyonu",
        role: "primary",
      },
    ];
    const report = buildSessionReport({
      sets: [set({ targets: hamTargets }), set({ targets: hamTargets })],
      histories: noHistory,
    });
    const ham = report.muscles.find((m) => m.muscleSlug === "hamstrings")!;
    expect(ham.primarySets).toBe(2); // 2 sets, not 4
    expect(ham.functions).toHaveLength(2);
    expect(ham.functions.every((f) => f.primarySets === 2)).toBe(true);
  });

  it("aggregates equivalents by muscle_function across different exercises", () => {
    // A dumbbell press shares chest horizontal adduction (primary) with bench.
    const dbPressTargets: ReportSet["targets"] = [
      {
        muscleSlug: "chest",
        muscleNameTr: "Göğüs",
        functionSlug: "chest-horizontal-adduction",
        functionNameTr: "Yatay addüksiyon",
        role: "primary",
      },
    ];
    const report = buildSessionReport({
      sets: [
        set(),
        set({ exerciseId: "db-press", exerciseName: "DB Press", targets: dbPressTargets }),
      ],
      histories: noHistory,
    });
    const chest = report.muscles.find((m) => m.muscleSlug === "chest")!;
    expect(chest.primarySets).toBe(2);
    const fn = chest.functions.find(
      (f) => f.functionSlug === "chest-horizontal-adduction",
    )!;
    expect(fn.primarySets).toBe(2);
  });
});

describe("buildSessionReport — per-exercise delta vs previous session", () => {
  it("flags weight up / reps down vs the previous top set", () => {
    const report = buildSessionReport({
      sets: [set({ weight: 105, reps: 4 })],
      histories: {
        bench: {
          prHistory: [{ weight: 100, reps: 5, rir: null }],
          prevSessionSets: [{ weight: 100, reps: 5, rir: null }],
        },
      },
    });
    const ex = report.exercises.find((e) => e.exerciseName === "Bench Press")!;
    expect(ex.weight).toBe("up");
    expect(ex.reps).toBe("down");
  });

  it("reports null delta when there is no previous session", () => {
    const report = buildSessionReport({ sets: [set()], histories: noHistory });
    const ex = report.exercises[0];
    expect(ex.weight).toBeNull();
    expect(ex.reps).toBeNull();
  });
});

describe("buildSessionReport — PR + RIR PR counts", () => {
  it("counts strength PRs against prior history (incl. progressive in-session sets)", () => {
    const report = buildSessionReport({
      sets: [set({ weight: 102.5, reps: 5 })],
      histories: {
        bench: {
          prHistory: [{ weight: 100, reps: 5, rir: null }],
          prevSessionSets: [{ weight: 100, reps: 5, rir: null }],
        },
      },
    });
    expect(report.prCount).toBe(1);
    expect(report.rirPrCount).toBe(0);
    const ex = report.exercises[0];
    expect(ex.sets[0].prType).toBe("weight");
  });

  it("counts RIR PRs separately from strength PRs", () => {
    const report = buildSessionReport({
      sets: [set({ weight: 100, reps: 5, rir: 1 })],
      histories: {
        bench: {
          prHistory: [{ weight: 100, reps: 5, rir: 3 }],
          prevSessionSets: [{ weight: 100, reps: 5, rir: 3 }],
        },
      },
    });
    expect(report.prCount).toBe(0);
    expect(report.rirPrCount).toBe(1);
    expect(report.exercises[0].sets[0].prType).toBe("rir");
  });

  it("does not count a PR on the first-ever set", () => {
    const report = buildSessionReport({ sets: [set()], histories: noHistory });
    expect(report.prCount).toBe(0);
  });

  it("counts a repeated identical top set only once", () => {
    // Three 55×10 sets when the prior best was 55×8: only the first is a PR.
    const report = buildSessionReport({
      sets: [set({ weight: 55, reps: 10 }), set({ weight: 55, reps: 10 }), set({ weight: 55, reps: 10 })],
      histories: {
        bench: {
          prHistory: [{ weight: 55, reps: 8, rir: null }],
          prevSessionSets: [{ weight: 55, reps: 8, rir: null }],
        },
      },
    });
    expect(report.prCount).toBe(1);
    expect(report.exercises[0].sets.map((s) => s.prType)).toEqual(["reps", null, null]);
  });
});

describe("buildSessionReport — time distribution", () => {
  it("attributes the gap before each set to its primary muscles; first block is 0", () => {
    const report = buildSessionReport({
      sets: [
        set({ performedAt: "2026-06-25T10:00:00.000Z" }),
        set({ performedAt: "2026-06-25T10:03:00.000Z" }), // +3 min
        set({ performedAt: "2026-06-25T10:06:30.000Z" }), // +3.5 min
      ],
      histories: noHistory,
    });
    const chest = report.muscles.find((m) => m.muscleSlug === "chest")!;
    // 0 + 180000 + 210000 = 390000 ms attributed to chest (primary).
    expect(chest.activeMs).toBe(390000);
    // Secondary-only muscles get no active time.
    const triceps = report.muscles.find((m) => m.muscleSlug === "triceps")!;
    expect(triceps.activeMs).toBe(0);
  });

  it("falls back to createdAt when performedAt is null", () => {
    const report = buildSessionReport({
      sets: [
        set({ performedAt: null, createdAt: "2026-06-25T10:00:00.000Z" }),
        set({ performedAt: null, createdAt: "2026-06-25T10:02:00.000Z" }),
      ],
      histories: noHistory,
    });
    const chest = report.muscles.find((m) => m.muscleSlug === "chest")!;
    expect(chest.activeMs).toBe(120000);
  });
});
