import { describe, it, expect } from "vitest";

import {
  CARDIO_ACTIVITIES,
  CARDIO_LABEL_TR,
  cardioWeeklySummary,
  formatDuration,
} from "./cardio";

describe("cardio registry", () => {
  it("labels every activity in Turkish exactly once", () => {
    const keys = CARDIO_ACTIVITIES.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of CARDIO_ACTIVITIES) {
      expect(CARDIO_LABEL_TR[a.key]).toBe(a.label);
    }
    expect(CARDIO_LABEL_TR.swim).toBe("Yüzme");
  });
});

describe("cardioWeeklySummary", () => {
  it("returns calm zeros for an empty week", () => {
    const s = cardioWeeklySummary([]);
    expect(s.totalMin).toBe(0);
    expect(s.count).toBe(0);
    expect(s.totalKm).toBeNull();
    expect(s.topActivity).toBeNull();
  });

  it("sums minutes, counts entries and picks the top activity by minutes", () => {
    const s = cardioWeeklySummary([
      { activity: "swim", duration_min: 30, distance_km: null, calories: null },
      { activity: "run", duration_min: 25, distance_km: "5.20", calories: 300 },
      { activity: "swim", duration_min: 20, distance_km: "1", calories: null },
    ]);
    expect(s.totalMin).toBe(75);
    expect(s.count).toBe(3);
    expect(s.topActivity).toBe("swim"); // 50 min beats run's 25
    expect(s.totalKm).toBeCloseTo(6.2, 5); // PG numerics arrive as strings
  });

  it("keeps km null when no entry has a distance", () => {
    const s = cardioWeeklySummary([
      { activity: "walk", duration_min: 40, distance_km: null, calories: null },
    ]);
    expect(s.totalKm).toBeNull();
  });
});

describe("formatDuration", () => {
  it("renders sub-hour minutes plainly", () => {
    expect(formatDuration(45)).toBe("45 dk");
  });

  it("splits hours and minutes", () => {
    expect(formatDuration(95)).toBe("1 s 35 dk");
  });

  it("drops a zero-minute remainder", () => {
    expect(formatDuration(120)).toBe("2 s");
  });
});
