/**
 * Personal-record engine.
 *
 * PRs are determined by comparing the current set to OBSERVED historical sets —
 * there are deliberately NO estimated-1RM formulas (Epley/Brzycki) here. The
 * rules and the configurable rep-drop thresholds are documented in
 * docs/plans/2026-06-25-phase2-pr-reports-design.md.
 */

export type PRSet = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
};

export type PRType = "weight" | "reps" | "both" | "tradeoff" | "rir";

export type PRResult = {
  isPR: boolean;
  /** null when not a PR. */
  type: PRType | null;
  /** the prior set we beat, for readable UI copy; null when not a PR. */
  reference: PRSet | null;
};

export type PRConfig = {
  /** reference reps -> minimum reps that must be maintained for a Rule B PR. */
  minMaintained: Record<number, number>;
  /** fallback minimum for reference reps not in the table (e.g. > 8). */
  minMaintainedDefault: number;
};

/**
 * Default thresholds. Low-rep references (1-3) keep `min = reference`, which
 * disables Rule B for them; a coach can lower these via config to allow heavy
 * low-rep trade-offs. A single source of truth so this stays tweakable.
 */
export const PR_CONFIG: PRConfig = {
  minMaintained: { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 4, 8: 4 },
  minMaintainedDefault: 4,
};

type ValidSet = { weight: number; reps: number; rir: number | null };

const NO_PR: PRResult = { isPR: false, type: null, reference: null };

function resolveConfig(config?: Partial<PRConfig>): PRConfig {
  return {
    minMaintained: { ...PR_CONFIG.minMaintained, ...(config?.minMaintained ?? {}) },
    minMaintainedDefault: config?.minMaintainedDefault ?? PR_CONFIG.minMaintainedDefault,
  };
}

function minMaintained(refReps: number, config: PRConfig): number {
  return config.minMaintained[refReps] ?? config.minMaintainedDefault;
}

function isValid(s: PRSet): s is ValidSet {
  return s.weight != null && s.reps != null && s.reps > 0;
}

export function evaluatePR(
  current: PRSet,
  history: PRSet[],
  config?: Partial<PRConfig>,
): PRResult {
  if (!isValid(current)) return NO_PR;
  const cfg = resolveConfig(config);
  const prior = history.filter(isValid);
  if (prior.length === 0) return NO_PR;

  const { weight: w, reps: r } = current;

  // A strength PR must be a NEW record: if any prior set already matches or beats
  // it on BOTH axes (>= weight AND >= reps), it is not a new best — only a RIR PR
  // is still possible. This stops a repeated equal top set from counting again.
  const alreadyAchieved = prior.some((p) => p.weight >= w && p.reps >= r);
  if (!alreadyAchieved) {
    // Rule A — dominance: current >= prior on both axes, strictly greater on one.
    // Pick the heaviest such reference (tie-break highest reps) for readable copy.
    let domRef: ValidSet | null = null;
    for (const p of prior) {
      const dominates = w >= p.weight && r >= p.reps && (w > p.weight || r > p.reps);
      if (!dominates) continue;
      if (!domRef || p.weight > domRef.weight || (p.weight === domRef.weight && p.reps > domRef.reps)) {
        domRef = p;
      }
    }
    if (domRef) {
      const type: PRType =
        w > domRef.weight && r > domRef.reps ? "both" : r === domRef.reps ? "weight" : "reps";
      return { isPR: true, type, reference: domRef };
    }

    // Rule B — trade-off: weight up, reps down within the allowed drop.
    for (const p of prior) {
      if (w > p.weight && r < p.reps && r >= minMaintained(p.reps, cfg)) {
        return { isPR: true, type: "tradeoff", reference: p };
      }
    }
  }

  // RIR PR — same weight + same reps, strictly lower RIR (harder effort). This is
  // independent of the strength record (the set is "already achieved" by design).
  if (current.rir != null) {
    for (const p of prior) {
      if (p.weight === w && p.reps === r && p.rir != null && current.rir < p.rir) {
        return { isPR: true, type: "rir", reference: p };
      }
    }
  }

  return NO_PR;
}

/**
 * Reduce a full set history to the compact frontier evaluatePR needs:
 * the non-dominated (weight, reps) pairs, keeping the lowest RIR seen per pair.
 * Mathematically sufficient for Rule A/B/RIR, so it shrinks the client payload.
 */
export function prFrontier(history: PRSet[]): PRSet[] {
  const valid = history.filter(isValid);

  // Lowest (best) RIR per (weight, reps).
  const byPair = new Map<string, ValidSet>();
  for (const p of valid) {
    const key = `${p.weight}|${p.reps}`;
    const prev = byPair.get(key);
    const rir =
      p.rir != null && (prev?.rir == null || p.rir < prev.rir) ? p.rir : (prev?.rir ?? p.rir);
    byPair.set(key, { weight: p.weight, reps: p.reps, rir });
  }

  const pairs = [...byPair.values()];
  return pairs.filter(
    (p) =>
      !pairs.some(
        (q) =>
          q !== p &&
          q.weight >= p.weight &&
          q.reps >= p.reps &&
          (q.weight > p.weight || q.reps > p.reps),
      ),
  );
}
