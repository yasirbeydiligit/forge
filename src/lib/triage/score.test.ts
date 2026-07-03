import { describe, expect, it } from "vitest";

import { DEFAULT_TRIAGE_CONFIG } from "./config";
import { computeTriage, filterDismissed, sortTriage } from "./score";
import type { TriageAlert, TriageInput, TriageResult } from "./types";

function makeAlert(overrides: Partial<TriageAlert> = {}): TriageAlert {
  return {
    key: "workout_gap",
    category: "adherence",
    dimension: "training",
    severity: "warning",
    titleTr: "t",
    detailTr: "d",
    fingerprint: "fp",
    tab: "antrenman",
    ...overrides,
  };
}

function makeInput(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    athleteId: "a1",
    fullName: "Sporcu",
    avatarUrl: null,
    joinedAt: "2026-01-01T00:00:00Z",
    goal: null,
    sessionDates: [],
    plateau: {},
    mealDays: [],
    proteinTarget: null,
    metricDays: [],
    protocolAssigned: 0,
    protocolCompletions: [],
    rirSessions: [],
    ...overrides,
  };
}

describe("computeTriage", () => {
  it("gives a clean athlete a perfect green score", () => {
    const r = computeTriage(makeInput(), [], DEFAULT_TRIAGE_CONFIG);
    expect(r.score).toBe(100);
    expect(r.band).toBe("green");
    expect(r.adherenceCount).toBe(0);
    expect(r.performanceCount).toBe(0);
  });

  it("weights adherence heavier than performance", () => {
    const adh = computeTriage(makeInput(), [makeAlert()], DEFAULT_TRIAGE_CONFIG);
    const perf = computeTriage(
      makeInput(),
      [makeAlert({ key: "plateau", category: "performance" })],
      DEFAULT_TRIAGE_CONFIG,
    );
    expect(adh.score).toBe(80);
    expect(perf.score).toBe(88);
    expect(adh.score).toBeLessThan(perf.score);
  });

  it("derives the band from the worst open alert", () => {
    const warning = computeTriage(makeInput(), [makeAlert()], DEFAULT_TRIAGE_CONFIG);
    const critical = computeTriage(
      makeInput(),
      [makeAlert(), makeAlert({ key: "meal_gap", severity: "critical" })],
      DEFAULT_TRIAGE_CONFIG,
    );
    expect(warning.band).toBe("amber");
    expect(critical.band).toBe("red");
  });

  it("clamps the score at zero", () => {
    const pile = Array.from({ length: 5 }, (_, i) =>
      makeAlert({ key: `k${i}`, severity: "critical" }),
    );
    const r = computeTriage(makeInput(), pile, DEFAULT_TRIAGE_CONFIG);
    expect(r.score).toBe(0);
  });

  it("counts categories and orders alerts adherence-first, critical-first", () => {
    const r = computeTriage(
      makeInput(),
      [
        makeAlert({ key: "plateau", category: "performance", severity: "warning" }),
        makeAlert({ key: "meal_gap", severity: "critical" }),
        makeAlert({ key: "workout_gap", severity: "warning" }),
      ],
      DEFAULT_TRIAGE_CONFIG,
    );
    expect(r.adherenceCount).toBe(2);
    expect(r.performanceCount).toBe(1);
    expect(r.alerts.map((a) => a.key)).toEqual(["meal_gap", "workout_gap", "plateau"]);
  });

  it("reports the most recent activity of any kind", () => {
    const r = computeTriage(
      makeInput({
        sessionDates: ["2026-06-20"],
        mealDays: [{ date: "2026-06-28", protein: 0 }],
        metricDays: [{ date: "2026-06-25", weight: null }],
        protocolCompletions: [{ date: "2026-06-27" }],
      }),
      [],
      DEFAULT_TRIAGE_CONFIG,
    );
    expect(r.lastActivity).toBe("2026-06-28");
  });

  it("returns null activity for an empty athlete", () => {
    expect(computeTriage(makeInput(), [], DEFAULT_TRIAGE_CONFIG).lastActivity).toBeNull();
  });
});

describe("filterDismissed", () => {
  it("drops only the exact (key, fingerprint) match for the athlete", () => {
    const open = filterDismissed(
      [makeAlert({ fingerprint: "2026-06-30:warning" }), makeAlert({ key: "meal_gap" })],
      [
        { athleteId: "a1", alertKey: "workout_gap", fingerprint: "2026-06-30:warning" },
        { athleteId: "OTHER", alertKey: "meal_gap", fingerprint: "fp" },
      ],
      "a1",
    );
    expect(open.map((a) => a.key)).toEqual(["meal_gap"]);
  });

  it("resurfaces the alert when the fingerprint moves on", () => {
    const open = filterDismissed(
      [makeAlert({ fingerprint: "2026-07-02:warning" })],
      [{ athleteId: "a1", alertKey: "workout_gap", fingerprint: "2026-06-30:warning" }],
      "a1",
    );
    expect(open).toHaveLength(1);
  });
});

describe("sortTriage", () => {
  function result(overrides: Partial<TriageResult>): TriageResult {
    return {
      athleteId: "x",
      fullName: "X",
      avatarUrl: null,
      score: 100,
      band: "green",
      alerts: [],
      adherenceCount: 0,
      performanceCount: 0,
      lastActivity: null,
      ...overrides,
    };
  }

  it("puts the worst score first and breaks ties by staler activity", () => {
    const sorted = sortTriage([
      result({ athleteId: "ok", score: 100, lastActivity: "2026-07-02" }),
      result({ athleteId: "bad", score: 30, lastActivity: "2026-07-01" }),
      result({ athleteId: "stale", score: 60, lastActivity: "2026-06-20" }),
      result({ athleteId: "fresh", score: 60, lastActivity: "2026-07-01" }),
      result({ athleteId: "silent", score: 60, lastActivity: null }),
    ]);
    expect(sorted.map((r) => r.athleteId)).toEqual([
      "bad",
      "silent",
      "stale",
      "fresh",
      "ok",
    ]);
  });
});
