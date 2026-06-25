import { describe, it, expect } from "vitest";

import { detectPlateau, type PlateauSessionStat } from "./plateau";

function s(
  date: string,
  topWeight: number,
  topReps: number,
  bestRir: number | null = null,
): PlateauSessionStat {
  return { date, topWeight, topReps, bestRir };
}

describe("detectPlateau", () => {
  it("flags a stall when the last 3 sessions show no progress", () => {
    const r = detectPlateau([
      s("2026-06-04", 100, 5),
      s("2026-06-11", 100, 5),
      s("2026-06-18", 100, 5),
    ]);
    expect(r.stalled).toBe(true);
    expect(r.sessions).toBe(3);
  });

  it("does not flag when weight improved within the window", () => {
    expect(
      detectPlateau([s("2026-06-04", 100, 5), s("2026-06-11", 102.5, 5), s("2026-06-18", 102.5, 5)])
        .stalled,
    ).toBe(false);
  });

  it("does not flag when reps improved", () => {
    expect(
      detectPlateau([s("2026-06-04", 100, 5), s("2026-06-11", 100, 6), s("2026-06-18", 100, 6)])
        .stalled,
    ).toBe(false);
  });

  it("does not flag when RIR improved (lower effort reserve)", () => {
    expect(
      detectPlateau([
        s("2026-06-04", 100, 5, 3),
        s("2026-06-11", 100, 5, 2),
        s("2026-06-18", 100, 5, 2),
      ]).stalled,
    ).toBe(false);
  });

  it("does not flag with fewer than N sessions", () => {
    expect(detectPlateau([s("2026-06-11", 100, 5), s("2026-06-18", 100, 5)]).stalled).toBe(false);
  });

  it("only considers the most recent N sessions", () => {
    // An old improvement is outside the 3-session window → still a stall.
    const r = detectPlateau([
      s("2026-05-28", 90, 5),
      s("2026-06-04", 100, 5),
      s("2026-06-11", 100, 5),
      s("2026-06-18", 100, 5),
    ]);
    expect(r.stalled).toBe(true);
  });

  it("respects a configurable window", () => {
    const data = [s("2026-06-04", 100, 5), s("2026-06-11", 100, 5)];
    expect(detectPlateau(data, { sessions: 2 }).stalled).toBe(true);
    expect(detectPlateau(data, { sessions: 3 }).stalled).toBe(false); // not enough data
  });

  it("sorts by date, so input order does not matter", () => {
    const r = detectPlateau([
      s("2026-06-18", 100, 5),
      s("2026-06-04", 100, 5),
      s("2026-06-11", 100, 5),
    ]);
    expect(r.stalled).toBe(true);
  });
});
