import { describe, it, expect } from "vitest";

import {
  buildCellConfigs,
  DEFAULT_ENABLED,
  METRICS,
  MIN_BASELINE_SAMPLES,
  computeBaseline,
  getMetric,
  metricCenter,
  parseGoals,
  resolveEnabled,
  trend,
  valence,
  weightPolarityForGoal,
} from "./metrics";

describe("METRICS registry", () => {
  it("exposes digestion as a 0–10 higher-is-better metric", () => {
    const d = getMetric("digestion");
    expect(d.polarity).toBe("higherBetter");
    expect(d.range).toEqual([0, 10]);
    expect(d.goalAllowed).toBe(false);
  });

  it("treats weight as trend-only (never good/bad)", () => {
    expect(getMetric("weight").polarity).toBe("trend");
  });

  it("keeps notes uncoloured", () => {
    expect(getMetric("notes").polarity).toBe("none");
  });

  it("lists every metric key exactly once", () => {
    const keys = METRICS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("registers steps as a higher-better goalable integer metric", () => {
    const def = getMetric("steps");
    expect(def.polarity).toBe("higherBetter");
    expect(def.goalAllowed).toBe(true);
    expect(def.range).toEqual([0, 100000]);
    expect(def.decimals).toBe(0);
  });

  it("includes steps in the default column set", () => {
    expect(DEFAULT_ENABLED).toContain("steps");
  });

  it("keeps steps in resolveEnabled round-trips (canonical order)", () => {
    expect(resolveEnabled(["steps", "weight"])).toEqual(["weight", "steps"]);
  });
});

describe("weightPolarityForGoal", () => {
  it("judges direction for directional goals", () => {
    expect(weightPolarityForGoal("fat_loss")).toBe("lowerBetter");
    expect(weightPolarityForGoal("muscle_gain")).toBe("higherBetter");
  });

  it("stays trend-only otherwise", () => {
    expect(weightPolarityForGoal("strength")).toBe("trend");
    expect(weightPolarityForGoal("maintenance")).toBe("trend");
    expect(weightPolarityForGoal(null)).toBe("trend");
    expect(weightPolarityForGoal(undefined)).toBe("trend");
  });
});

describe("computeBaseline", () => {
  it("returns a null mean below the minimum sample count", () => {
    const few = Array.from({ length: MIN_BASELINE_SAMPLES - 1 }, () => 8);
    const b = computeBaseline(few, 0.5);
    expect(b.mean).toBeNull();
    expect(b.count).toBe(MIN_BASELINE_SAMPLES - 1);
  });

  it("computes the mean and standard-deviation spread", () => {
    const b = computeBaseline([6, 8, 6, 8], 0.1);
    expect(b.mean).toBe(7);
    expect(b.spread).toBeCloseTo(1, 5); // population std of [6,8,6,8]
  });

  it("floors the spread so a near-constant series stays calm", () => {
    const b = computeBaseline([8, 8, 8, 8], 0.5);
    expect(b.spread).toBe(0.5);
  });

  it("ignores non-finite values", () => {
    const b = computeBaseline([7, NaN, 7, 7, 7], 0.1);
    expect(b.count).toBe(4);
    expect(b.mean).toBe(7);
  });
});

describe("valence", () => {
  const higher = { polarity: "higherBetter" as const, center: 8, spread: 1 };
  const lower = { polarity: "lowerBetter" as const, center: 55, spread: 4 };

  it("is good when a higher-is-better value clears the upper band", () => {
    expect(valence(9.5, higher)).toBe("good");
  });

  it("is bad when a higher-is-better value falls below the lower band", () => {
    expect(valence(6.5, higher)).toBe("bad");
  });

  it("is neutral inside the band", () => {
    expect(valence(8.3, higher)).toBe("neutral");
  });

  it("inverts direction for lower-is-better metrics", () => {
    expect(valence(48, lower)).toBe("good"); // resting HR well below center
    expect(valence(62, lower)).toBe("bad");
  });

  it("never judges trend-only or uncoloured metrics", () => {
    expect(valence(80, { polarity: "trend", center: 78, spread: 1 })).toBe(
      "none",
    );
    expect(valence(1, { polarity: "none", center: 1, spread: 1 })).toBe("none");
  });

  it("returns none when there is no center to compare against", () => {
    expect(valence(8, { polarity: "higherBetter", center: null, spread: 1 })).toBe(
      "none",
    );
  });
});

describe("metricCenter", () => {
  it("prefers an explicit goal over the baseline mean", () => {
    expect(metricCenter({ mean: 7.2, spread: 1, count: 10 }, 8)).toBe(8);
  });

  it("falls back to the baseline mean when no goal is set", () => {
    expect(metricCenter({ mean: 7.2, spread: 1, count: 10 }, null)).toBe(7.2);
  });

  it("is null when there is neither a goal nor enough history", () => {
    expect(metricCenter({ mean: null, spread: 0.5, count: 1 }, null)).toBeNull();
  });
});

describe("resolveEnabled", () => {
  it("falls back to the default set when nothing is stored", () => {
    expect(resolveEnabled(null)).toEqual(DEFAULT_ENABLED);
    expect(resolveEnabled([])).toEqual(DEFAULT_ENABLED);
    expect(resolveEnabled("garbage")).toEqual(DEFAULT_ENABLED);
  });

  it("keeps only known keys and renders them in registry order", () => {
    // stored out of order + an unknown key
    const out = resolveEnabled(["notes", "bogus", "weight", "digestion"]);
    expect(out).toEqual(["weight", "digestion", "notes"]);
  });

  it("dedupes repeated keys", () => {
    expect(resolveEnabled(["weight", "weight"])).toEqual(["weight"]);
  });

  it("includes digestion once enabled (it is off by default)", () => {
    expect(DEFAULT_ENABLED).not.toContain("digestion");
    expect(resolveEnabled(["digestion"])).toEqual(["digestion"]);
  });
});

describe("parseGoals", () => {
  it("keeps finite goals for goal-allowed metrics", () => {
    expect(parseGoals({ sleep_hours: 8, weight: 78 })).toEqual({
      sleep_hours: 8,
      weight: 78,
    });
  });

  it("drops goals for metrics that don't allow one", () => {
    expect(parseGoals({ energy: 9, hunger: 2 })).toEqual({});
  });

  it("drops out-of-range, non-numeric, and unknown keys", () => {
    expect(
      parseGoals({ sleep_hours: 99, resting_hr: "x", bogus: 5 }),
    ).toEqual({});
  });

  it("returns an empty map for non-object input", () => {
    expect(parseGoals(null)).toEqual({});
    expect(parseGoals("nope")).toEqual({});
  });
});

describe("trend", () => {
  it("reads direction against a reference", () => {
    expect(trend(80, 78)).toBe("up");
    expect(trend(77, 78)).toBe("down");
    expect(trend(78, 78)).toBe("flat");
  });

  it("is none without a reference", () => {
    expect(trend(80, null)).toBe("none");
  });
});

describe("buildCellConfigs", () => {
  const history = [
    { sleep_hours: 7, weight: "80.0" },
    { sleep_hours: 8, weight: "80.5" },
    { sleep_hours: 7.5, weight: "81.0" },
    { sleep_hours: 8.5, weight: "80.5" },
  ];

  it("gives weight a goal-directed polarity centred on the athlete's own mean", () => {
    const configs = buildCellConfigs({
      historyRows: history,
      columns: ["weight"],
      goals: { weight: 75 }, // explicit goal must NOT override the mean
      profileGoal: "fat_loss",
    });
    expect(configs.weight!.polarity).toBe("lowerBetter");
    expect(configs.weight!.center).toBeCloseTo(80.5, 5);
  });

  it("keeps weight as an unjudged trend without a directional goal", () => {
    const configs = buildCellConfigs({
      historyRows: history,
      columns: ["weight"],
      goals: {},
      profileGoal: "maintenance",
    });
    expect(configs.weight!.polarity).toBe("trend");
  });

  it("prefers an explicit goal as the center for ordinary metrics", () => {
    const configs = buildCellConfigs({
      historyRows: history,
      columns: ["sleep_hours"],
      goals: { sleep_hours: 9 },
      profileGoal: null,
    });
    expect(configs.sleep_hours!.center).toBe(9);
  });

  it("returns a null center when history is too thin and no goal exists", () => {
    const configs = buildCellConfigs({
      historyRows: history.slice(0, 2),
      columns: ["sleep_hours"],
      goals: {},
      profileGoal: null,
    });
    expect(configs.sleep_hours!.center).toBeNull();
  });
});
