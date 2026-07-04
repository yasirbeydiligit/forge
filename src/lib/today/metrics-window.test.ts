import { describe, it, expect } from "vitest";

import { summarizeMetric } from "./metrics-window";

const TODAY = "2026-07-01";

// Deliberately unsorted, mixed null/number/string (PG numerics arrive as strings).
const ROWS = [
  { metric_date: "2026-06-28", weight: "80.00", steps: 9000 },
  { metric_date: "2026-07-01", weight: "79.50", steps: 12000 },
  { metric_date: "2026-06-30", weight: null, steps: 6000 },
  { metric_date: "2026-06-29", weight: "79.80", steps: null },
];

describe("summarizeMetric", () => {
  it("returns calm nulls for no rows", () => {
    const s = summarizeMetric([], "weight", TODAY);
    expect(s.latest).toBeNull();
    expect(s.previous).toBeNull();
    expect(s.delta).toBeNull();
    expect(s.todayValue).toBeNull();
    expect(s.series).toEqual([]);
  });

  it("builds a chronological non-null series for the sparkline", () => {
    const s = summarizeMetric(ROWS, "weight", TODAY);
    // 06-28, 06-29, 07-01 have weights; 06-30 is null and is skipped.
    expect(s.series).toEqual([80, 79.8, 79.5]);
  });

  it("picks latest + previous non-null values and their signed delta", () => {
    const s = summarizeMetric(ROWS, "weight", TODAY);
    expect(s.latest).toBe(79.5); // most recent non-null (07-01)
    expect(s.previous).toBe(79.8); // the one before it (06-29)
    expect(s.delta).toBeCloseTo(-0.3, 5);
  });

  it("exposes the value logged exactly on today, or null", () => {
    expect(summarizeMetric(ROWS, "steps", TODAY).todayValue).toBe(12000);
    // steps has no row on a day without an entry
    expect(summarizeMetric(ROWS, "steps", "2026-06-30").todayValue).toBe(6000);
    expect(summarizeMetric(ROWS, "steps", "2026-06-29").todayValue).toBeNull();
  });

  it("coerces numeric strings and treats non-finite as missing", () => {
    const s = summarizeMetric(
      [
        { metric_date: "2026-06-30", weight: "77.2" },
        { metric_date: "2026-07-01", weight: "" },
      ],
      "weight",
      TODAY,
    );
    expect(s.series).toEqual([77.2]);
    expect(s.latest).toBe(77.2);
    expect(s.todayValue).toBeNull(); // "" is not a finite number
  });
});
