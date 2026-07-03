import { describe, expect, it } from "vitest";

import { DEFAULT_TRIAGE_CONFIG } from "./config";
import { detectAlerts } from "./alerts";
import type { TriageInput } from "./types";

const TODAY = "2026-07-03";

/** A healthy, fully-active athlete: no detector should fire on this base. */
function baseInput(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    athleteId: "a1",
    fullName: "Test Sporcu",
    avatarUrl: null,
    joinedAt: "2026-01-01T00:00:00Z",
    goal: null,
    sessionDates: ["2026-07-02"],
    plateau: {},
    mealDays: [{ date: "2026-07-02", protein: 0 }],
    proteinTarget: null,
    metricDays: [{ date: "2026-07-02", weight: null }],
    protocolAssigned: 0,
    protocolCompletions: [],
    rirSessions: [],
    ...overrides,
  };
}

function alerts(overrides: Partial<TriageInput>, today = TODAY) {
  return detectAlerts(baseInput(overrides), DEFAULT_TRIAGE_CONFIG, today);
}

function byKey(list: ReturnType<typeof alerts>, key: string) {
  return list.find((a) => a.key === key);
}

describe("adherence: workout_gap", () => {
  it("stays silent when the athlete trained yesterday", () => {
    expect(byKey(alerts({ sessionDates: ["2026-07-02"] }), "workout_gap")).toBeUndefined();
  });

  it("fires a warning after the configured gap", () => {
    const a = byKey(alerts({ sessionDates: ["2026-06-30"] }), "workout_gap");
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.category).toBe("adherence");
    expect(a!.dimension).toBe("training");
    expect(a!.titleTr).toContain("3 gündür");
  });

  it("escalates to critical at a week", () => {
    const a = byKey(alerts({ sessionDates: ["2026-06-25"] }), "workout_gap");
    expect(a!.severity).toBe("critical");
  });

  it("flags an older account that never logged anything", () => {
    const a = byKey(
      alerts({ sessionDates: [], joinedAt: "2026-06-29T00:00:00Z" }),
      "workout_gap",
    );
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.titleTr).toContain("Hiç");
    expect(a!.fingerprint).toContain("never");
  });

  it("gives brand-new accounts a grace period", () => {
    const a = byKey(
      alerts({ sessionDates: [], joinedAt: "2026-07-02T00:00:00Z" }),
      "workout_gap",
    );
    expect(a).toBeUndefined();
  });

  it("keys the fingerprint on the last session date and severity", () => {
    const warn = byKey(alerts({ sessionDates: ["2026-06-30"] }), "workout_gap");
    const crit = byKey(alerts({ sessionDates: ["2026-06-25"] }), "workout_gap");
    expect(warn!.fingerprint).toContain("2026-06-30");
    expect(crit!.fingerprint).toContain("2026-06-25");
    expect(warn!.fingerprint).not.toBe(crit!.fingerprint);
  });
});

describe("adherence: meal_gap", () => {
  it("does not fire when yesterday has a meal, even if today is empty", () => {
    expect(
      byKey(alerts({ mealDays: [{ date: "2026-07-02", protein: 100 }] }), "meal_gap"),
    ).toBeUndefined();
  });

  it("fires a warning after two meal-less days ending yesterday", () => {
    const a = byKey(alerts({ mealDays: [{ date: "2026-06-30", protein: 100 }] }), "meal_gap");
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.dimension).toBe("nutrition");
  });

  it("escalates to critical after five meal-less days", () => {
    const a = byKey(alerts({ mealDays: [{ date: "2026-06-27", protein: 100 }] }), "meal_gap");
    expect(a!.severity).toBe("critical");
  });
});

describe("adherence: checkin_gap", () => {
  it("does not fire when a check-in exists within the window", () => {
    expect(
      byKey(alerts({ metricDays: [{ date: "2026-07-01", weight: null }] }), "checkin_gap"),
    ).toBeUndefined();
  });

  it("fires a warning after three days without a check-in", () => {
    const a = byKey(
      alerts({ metricDays: [{ date: "2026-06-30", weight: null }] }),
      "checkin_gap",
    );
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.dimension).toBe("tracking");
  });

  it("escalates to critical after a week", () => {
    const a = byKey(
      alerts({ metricDays: [{ date: "2026-06-25", weight: null }] }),
      "checkin_gap",
    );
    expect(a!.severity).toBe("critical");
  });
});

describe("adherence: protocol_low", () => {
  it("does not fire without assignments", () => {
    expect(byKey(alerts({ protocolAssigned: 0 }), "protocol_low")).toBeUndefined();
  });

  it("does not fire when the completion rate clears the floor", () => {
    // 1 assignment × 7 days = 7 expected; 5 done = 0.71.
    const done = ["06-27", "06-28", "06-29", "06-30", "07-01"].map((d) => ({
      date: `2026-${d}`,
    }));
    expect(
      byKey(alerts({ protocolAssigned: 1, protocolCompletions: done }), "protocol_low"),
    ).toBeUndefined();
  });

  it("fires a warning below the floor", () => {
    // 2 assignments × 7 days = 14 expected; 7 done = 0.5.
    const done = Array.from({ length: 7 }, (_, i) => ({ date: `2026-06-2${i + 1}` }));
    const a = byKey(
      alerts({ protocolAssigned: 2, protocolCompletions: done }),
      "protocol_low",
    );
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.dimension).toBe("protocol");
    expect(a!.tab).toBe("beslenme");
  });

  it("escalates to critical below the critical floor", () => {
    // 2 × 7 = 14 expected; 3 done ≈ 0.21.
    const done = [{ date: "2026-07-01" }, { date: "2026-07-02" }, { date: "2026-06-30" }];
    const a = byKey(
      alerts({ protocolAssigned: 2, protocolCompletions: done }),
      "protocol_low",
    );
    expect(a!.severity).toBe("critical");
  });
});

describe("performance: protein_low", () => {
  const target = 180; // floor 0.9 -> 162

  it("does not fire without a protein target", () => {
    const days = [
      { date: "2026-07-02", protein: 100 },
      { date: "2026-07-01", protein: 100 },
      { date: "2026-06-30", protein: 100 },
    ];
    expect(byKey(alerts({ mealDays: days, proteinTarget: null }), "protein_low")).toBeUndefined();
  });

  it("fires after three consecutive logged days below the floor", () => {
    const days = [
      { date: "2026-07-02", protein: 150 },
      { date: "2026-07-01", protein: 155 },
      { date: "2026-06-30", protein: 140 },
    ];
    const a = byKey(alerts({ mealDays: days, proteinTarget: target }), "protein_low");
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.category).toBe("performance");
    expect(a!.dimension).toBe("nutrition");
    expect(a!.detailTr).toContain("3");
  });

  it("skips unlogged days when counting the streak", () => {
    // 07-01 missing entirely: streak is still 3 logged days.
    const days = [
      { date: "2026-07-02", protein: 150 },
      { date: "2026-06-30", protein: 155 },
      { date: "2026-06-29", protein: 140 },
    ];
    expect(byKey(alerts({ mealDays: days, proteinTarget: target }), "protein_low")).toBeDefined();
  });

  it("resets the streak when the most recent logged day hits the target", () => {
    const days = [
      { date: "2026-07-02", protein: 175 },
      { date: "2026-07-01", protein: 100 },
      { date: "2026-06-30", protein: 100 },
    ];
    expect(byKey(alerts({ mealDays: days, proteinTarget: target }), "protein_low")).toBeUndefined();
  });

  it("needs the full streak length", () => {
    const days = [
      { date: "2026-07-02", protein: 150 },
      { date: "2026-07-01", protein: 155 },
    ];
    expect(byKey(alerts({ mealDays: days, proteinTarget: target }), "protein_low")).toBeUndefined();
  });
});

describe("performance: plateau", () => {
  const stalled = {
    exerciseName: "Bench Press",
    stats: [
      { date: "2026-06-20", topWeight: 100, topReps: 8, bestRir: 2 },
      { date: "2026-06-25", topWeight: 100, topReps: 8, bestRir: 2 },
      { date: "2026-07-01", topWeight: 100, topReps: 8, bestRir: 2 },
    ],
  };
  const progressing = {
    exerciseName: "Squat",
    stats: [
      { date: "2026-06-20", topWeight: 120, topReps: 5, bestRir: 2 },
      { date: "2026-06-25", topWeight: 122.5, topReps: 5, bestRir: 2 },
      { date: "2026-07-01", topWeight: 125, topReps: 5, bestRir: 2 },
    ],
  };

  it("groups all stalled exercises into a single alert", () => {
    const a = byKey(
      alerts({
        plateau: {
          e1: stalled,
          e2: { ...stalled, exerciseName: "Row" },
          e3: progressing,
        },
      }),
      "plateau",
    );
    expect(a).toBeDefined();
    expect(a!.titleTr).toContain("2 egzersizde");
    expect(a!.detailTr).toContain("Bench Press");
    expect(a!.detailTr).toContain("Row");
    expect(a!.detailTr).not.toContain("Squat");
    expect(a!.dimension).toBe("training");
    expect(a!.category).toBe("performance");
  });

  it("stays silent when everything progresses", () => {
    expect(byKey(alerts({ plateau: { e3: progressing } }), "plateau")).toBeUndefined();
  });
});

describe("performance: weight_trend", () => {
  // Weekly averages counting back from today: w0 newest.
  function weights(perWeek: number[]): { date: string; weight: number }[] {
    // Place each week's value on 2 days inside that 7-day bucket.
    const out: { date: string; weight: number }[] = [];
    perWeek.forEach((w, week) => {
      for (const offset of [1, 3]) {
        const day = new Date(Date.UTC(2026, 6, 3)); // TODAY
        day.setUTCDate(day.getUTCDate() - week * 7 - offset);
        out.push({ date: day.toISOString().slice(0, 10), weight: w });
      }
    });
    return out;
  }

  it("fires when a fat-loss athlete gains for two straight weeks", () => {
    const a = byKey(
      alerts({ goal: "fat_loss", metricDays: weights([81, 80.5, 80]) }),
      "weight_trend",
    );
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.dimension).toBe("tracking");
    expect(a!.category).toBe("performance");
  });

  it("fires when a muscle-gain athlete keeps losing", () => {
    const a = byKey(
      alerts({ goal: "muscle_gain", metricDays: weights([79, 79.5, 80]) }),
      "weight_trend",
    );
    expect(a).toBeDefined();
  });

  it("ignores maintenance and strength goals", () => {
    expect(
      byKey(alerts({ goal: "maintenance", metricDays: weights([82, 81, 80]) }), "weight_trend"),
    ).toBeUndefined();
    expect(
      byKey(alerts({ goal: "strength", metricDays: weights([82, 81, 80]) }), "weight_trend"),
    ).toBeUndefined();
  });

  it("needs the full run of wrong-direction weeks", () => {
    // Only one wrong week (w0 > w1), the older pair moves the right way.
    expect(
      byKey(alerts({ goal: "fat_loss", metricDays: weights([80.6, 80, 81]) }), "weight_trend"),
    ).toBeUndefined();
  });

  it("ignores sub-threshold drift", () => {
    expect(
      byKey(alerts({ goal: "fat_loss", metricDays: weights([80.2, 80.1, 80]) }), "weight_trend"),
    ).toBeUndefined();
  });
});

describe("performance: rir_extreme", () => {
  it("flags a consistently high average RIR", () => {
    const a = byKey(
      alerts({
        rirSessions: [
          { date: "2026-06-28", avgRir: 4.0, setCount: 10 },
          { date: "2026-06-30", avgRir: 3.8, setCount: 12 },
          { date: "2026-07-02", avgRir: 3.6, setCount: 9 },
        ],
      }),
      "rir_extreme",
    );
    expect(a).toBeDefined();
    expect(a!.severity).toBe("warning");
    expect(a!.detailTr).toContain("temkinli");
  });

  it("flags a consistently near-failure RIR", () => {
    const a = byKey(
      alerts({
        rirSessions: [
          { date: "2026-06-28", avgRir: 0.2, setCount: 10 },
          { date: "2026-06-30", avgRir: 0.3, setCount: 12 },
          { date: "2026-07-02", avgRir: 0.0, setCount: 9 },
        ],
      }),
      "rir_extreme",
    );
    expect(a).toBeDefined();
    expect(a!.detailTr).toContain("sınır");
  });

  it("needs enough sessions and sets", () => {
    expect(
      byKey(
        alerts({
          rirSessions: [
            { date: "2026-06-30", avgRir: 4.0, setCount: 10 },
            { date: "2026-07-02", avgRir: 4.0, setCount: 12 },
          ],
        }),
        "rir_extreme",
      ),
    ).toBeUndefined();
    expect(
      byKey(
        alerts({
          rirSessions: [
            { date: "2026-06-28", avgRir: 4.0, setCount: 1 },
            { date: "2026-06-30", avgRir: 4.0, setCount: 2 },
            { date: "2026-07-02", avgRir: 4.0, setCount: 1 },
          ],
        }),
        "rir_extreme",
      ),
    ).toBeUndefined();
  });

  it("stays silent for a healthy RIR range", () => {
    expect(
      byKey(
        alerts({
          rirSessions: [
            { date: "2026-06-28", avgRir: 2.0, setCount: 10 },
            { date: "2026-06-30", avgRir: 1.5, setCount: 12 },
            { date: "2026-07-02", avgRir: 2.5, setCount: 9 },
          ],
        }),
        "rir_extreme",
      ),
    ).toBeUndefined();
  });
});

describe("category split", () => {
  it("marks every gap alert as adherence", () => {
    const list = alerts({
      sessionDates: ["2026-06-20"],
      mealDays: [],
      metricDays: [],
      joinedAt: "2026-06-01T00:00:00Z",
    });
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const a of list) expect(a.category).toBe("adherence");
  });
});
