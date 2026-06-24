import { describe, it, expect } from "vitest";

import { evaluateRules, type InsightRule } from "./insights";

/** An enabled insight rule with sensible defaults; override per test. */
function rule(overrides: Partial<InsightRule> = {}): InsightRule {
  return {
    key: "low-protein",
    metric: "protein_per_bw_7d",
    comparator: "<",
    threshold: 1.6,
    scope: "nutrition",
    retrievalQuery: null,
    pinnedChunkId: "chunk-1",
    noteTemplate:
      "Günlük proteinin {value} g/kg, hedefin {threshold} g/kg altında.",
    enabled: true,
    ...overrides,
  };
}

describe("evaluateRules", () => {
  it("fires a `<` rule when the metric is below the threshold", () => {
    const fired = evaluateRules([rule()], { protein_per_bw_7d: 1.2 });
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({
      key: "low-protein",
      scope: "nutrition",
      metric: "protein_per_bw_7d",
      value: 1.2,
      pinnedChunkId: "chunk-1",
      retrievalQuery: null,
    });
  });

  it("does not fire a `<` rule when the metric is at the threshold", () => {
    expect(evaluateRules([rule()], { protein_per_bw_7d: 1.6 })).toEqual([]);
  });

  it("supports the `>=` comparator (fires at the boundary)", () => {
    const r = rule({ comparator: ">=", threshold: 8 });
    expect(evaluateRules([r], { protein_per_bw_7d: 8 })).toHaveLength(1);
    expect(evaluateRules([r], { protein_per_bw_7d: 7.9 })).toEqual([]);
  });

  it("supports the `>` comparator (does NOT fire at the boundary)", () => {
    const r = rule({ comparator: ">", threshold: 8 });
    expect(evaluateRules([r], { protein_per_bw_7d: 8.1 })).toHaveLength(1);
    expect(evaluateRules([r], { protein_per_bw_7d: 8 })).toEqual([]);
  });

  it("supports the `<=` comparator (fires at the boundary)", () => {
    const r = rule({ comparator: "<=", threshold: 6 });
    expect(evaluateRules([r], { protein_per_bw_7d: 6 })).toHaveLength(1);
    expect(evaluateRules([r], { protein_per_bw_7d: 6.1 })).toEqual([]);
  });

  it("supports the `==` comparator (fires only at the exact threshold)", () => {
    const r = rule({ comparator: "==", threshold: 7 });
    expect(evaluateRules([r], { protein_per_bw_7d: 7 })).toHaveLength(1);
    expect(evaluateRules([r], { protein_per_bw_7d: 7.0001 })).toEqual([]);
  });

  it("never fires a disabled rule, even when the comparison would hold", () => {
    const r = rule({ enabled: false });
    expect(evaluateRules([r], { protein_per_bw_7d: 0.5 })).toEqual([]);
  });

  it("does not fire when the referenced metric is missing (undefined)", () => {
    expect(evaluateRules([rule()], {})).toEqual([]);
  });

  it("does not fire when the referenced metric is null", () => {
    expect(evaluateRules([rule()], { protein_per_bw_7d: null })).toEqual([]);
  });

  it("does not fire when the threshold is null", () => {
    const r = rule({ threshold: null });
    expect(evaluateRules([r], { protein_per_bw_7d: 1.2 })).toEqual([]);
  });

  it("does not fire (and does not throw) for an unknown comparator", () => {
    const r = rule({ comparator: "!=" });
    expect(evaluateRules([r], { protein_per_bw_7d: 1.2 })).toEqual([]);
  });

  it("substitutes {value} (rounded to 1 decimal) and {threshold} into the note", () => {
    const r = rule({
      noteTemplate: "Değer {value}, eşik {threshold}.",
      threshold: 1.6,
    });
    const [fired] = evaluateRules([r], { protein_per_bw_7d: 1.23456 });
    expect(fired.text).toBe("Değer 1.2, eşik 1.6.");
  });

  it("replaces ALL occurrences of {value} and {threshold}", () => {
    const r = rule({
      noteTemplate: "{value}/{threshold} ({value} vs {threshold})",
      threshold: 2,
    });
    const [fired] = evaluateRules([r], { protein_per_bw_7d: 1.5 });
    expect(fired.text).toBe("1.5/2 (1.5 vs 2)");
  });

  it("leaves other template text intact when there are no placeholders", () => {
    const r = rule({ noteTemplate: "Proteinini artır." });
    const [fired] = evaluateRules([r], { protein_per_bw_7d: 1 });
    expect(fired.text).toBe("Proteinini artır.");
  });

  it("evaluates multiple rules and returns only the ones that fire", () => {
    const rules = [
      rule({ key: "low-protein", metric: "protein_per_bw_7d", comparator: "<", threshold: 1.6 }),
      rule({ key: "low-sleep", metric: "sleep_7d", comparator: "<", threshold: 7 }),
      rule({ key: "low-rir", metric: "rir_7d", comparator: "<=", threshold: 2 }),
    ];
    const fired = evaluateRules(rules, {
      protein_per_bw_7d: 1.2, // fires
      sleep_7d: 8, // does not fire
      rir_7d: 1.2, // fires (low RIR = near failure)
    });
    expect(fired.map((f) => f.key)).toEqual(["low-protein", "low-rir"]);
  });

  it("returns [] when given no rules", () => {
    expect(evaluateRules([], { protein_per_bw_7d: 1 })).toEqual([]);
  });

  it("carries retrievalQuery through when a rule has no pinned chunk", () => {
    const r = rule({ pinnedChunkId: null, retrievalQuery: "protein intake hypertrophy" });
    const [fired] = evaluateRules([r], { protein_per_bw_7d: 1.2 });
    expect(fired.pinnedChunkId).toBeNull();
    expect(fired.retrievalQuery).toBe("protein intake hypertrophy");
  });
});
