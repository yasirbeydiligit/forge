import { describe, expect, it } from "vitest";

import { countPrEvents, type DatedPRSet } from "./count-events";

function s(date: string, weight: number, reps: number, rir: number | null = null): DatedPRSet {
  return { date, weight, reps, rir };
}

describe("countPrEvents", () => {
  it("counts strength PR events inside the range, fed by earlier history", () => {
    const sets = [
      s("2026-03-01", 100, 5), // history only
      s("2026-04-05", 100, 5), // in range, already achieved → no PR
      s("2026-04-12", 102.5, 5), // weight PR
      s("2026-04-19", 102.5, 7), // reps PR
    ];
    expect(countPrEvents(sets, "2026-04-01")).toBe(2);
  });

  it("respects the optional end of the range", () => {
    const sets = [
      s("2026-04-05", 100, 5),
      s("2026-04-12", 102.5, 5), // inside
      s("2026-05-20", 105, 5), // after `to`
    ];
    expect(countPrEvents(sets, "2026-04-01", "2026-04-30")).toBe(1);
  });

  it("ignores RIR-only PRs", () => {
    const sets = [s("2026-04-05", 100, 5, 2), s("2026-04-12", 100, 5, 1)];
    expect(countPrEvents(sets, "2026-04-01")).toBe(0);
  });

  it("returns zero when the first-ever set is the only one (no reference)", () => {
    expect(countPrEvents([s("2026-04-05", 100, 5)], "2026-04-01")).toBe(0);
  });
});
