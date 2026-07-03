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
