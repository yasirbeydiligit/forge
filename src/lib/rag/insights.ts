/**
 * Rule-based insight engine — PURE evaluator.
 *
 * This is the LLM-FREE core of the Research Library "woven-in insights"
 * feature: rules authored against the athlete's OWN logged metrics. A fired
 * rule renders a cited margin note from a pinned library chunk. There are NO
 * LLM / Voyage calls here (nor anywhere in the render path).
 *
 * This module is deliberately PURE: it imports neither `ragEnv` (server-only,
 * throws on import), `server-only`, nor any `next/headers`-bound client, so the
 * unit test can import it directly. The DB / auth wiring lives in the sibling
 * `insights-server.ts` (which `getAthleteInsights` uses), mirroring the
 * request.ts / actions.ts split in `src/app/(app)/kutuphane`.
 */

/**
 * An insight rule, normalised to camelCase from the `insight_rules` table row.
 * `metric` is a key into the metric vocabulary (see insights-server.ts).
 */
export type InsightRule = {
  key: string;
  metric: string;
  comparator: string;
  threshold: number | null;
  scope: string | null;
  retrievalQuery: string | null;
  pinnedChunkId: string | null;
  noteTemplate: string;
  enabled: boolean;
};

/** The result of a rule that fired against the athlete's metrics. */
export type FiredRule = {
  key: string;
  scope: string | null;
  metric: string;
  /** The athlete's metric value that triggered the rule. */
  value: number;
  /** `noteTemplate` with {value}/{threshold} substituted. */
  text: string;
  pinnedChunkId: string | null;
  retrievalQuery: string | null;
};

/** Round to one decimal place for display in note text. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Compare `value` against `threshold` using a textual comparator. Supports
 * `>=`, `>`, `<=`, `<`, `==`. Any unknown comparator returns false (the rule
 * simply doesn't fire) — we never throw on bad rule data.
 */
function compare(value: number, comparator: string, threshold: number): boolean {
  switch (comparator) {
    case ">=":
      return value >= threshold;
    case ">":
      return value > threshold;
    case "<=":
      return value <= threshold;
    case "<":
      return value < threshold;
    case "==":
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Render a fired rule's note by substituting placeholders into `noteTemplate`:
 *   - `{value}`     → the metric value, rounded to 1 decimal
 *   - `{threshold}` → the rule threshold (as-is)
 * All occurrences are replaced; other text is left intact.
 */
function renderNote(
  template: string,
  value: number,
  threshold: number,
): string {
  return template
    .split("{value}")
    .join(String(round1(value)))
    .split("{threshold}")
    .join(String(threshold));
}

/**
 * Evaluate `rules` against a metric snapshot. For each ENABLED rule:
 *   - look up `metrics[rule.metric]`; null/undefined → does not fire,
 *   - require a numeric `threshold`,
 *   - compare with `rule.comparator`; if it holds, the rule fires.
 *
 * Returns the fired rules in input order. Pure: no I/O, no env, no DB.
 */
export function evaluateRules(
  rules: InsightRule[],
  metrics: Record<string, number | null | undefined>,
): FiredRule[] {
  const fired: FiredRule[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.threshold == null) continue;

    const value = metrics[rule.metric];
    if (value == null) continue;

    if (!compare(value, rule.comparator, rule.threshold)) continue;

    fired.push({
      key: rule.key,
      scope: rule.scope,
      metric: rule.metric,
      value,
      text: renderNote(rule.noteTemplate, value, rule.threshold),
      pinnedChunkId: rule.pinnedChunkId,
      retrievalQuery: rule.retrievalQuery,
    });
  }

  return fired;
}
