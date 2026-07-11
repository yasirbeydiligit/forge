import { evaluatePR, type PRResult, type PRSet } from "@/lib/pr/evaluate-pr";

import type { ExerciseState } from "./types";

/**
 * Whether a freshly-completed set is a PR for this exercise, judged against the
 * observed history (the exercise's PR frontier plus any sets already done this
 * session) — see src/lib/pr/evaluate-pr.ts. A first-ever set (empty history) is
 * never flagged, so the PR signal stays meaningful.
 */
export function detectPr(history: PRSet[], set: PRSet): boolean {
  return detectPrResult(history, set).isPR;
}

/** Same check, keeping the full result (PR type + beaten reference) for UI copy. */
export function detectPrResult(history: PRSet[], set: PRSet): PRResult {
  return evaluatePR(set, history);
}

/**
 * Session-level tallies. "Volume" in this product is SET COUNT (not tonnage),
 * so this returns the number of completed sets and how many were PRs.
 */
export function sessionTotals(exercises: ExerciseState[]): {
  setCount: number;
  prCount: number;
} {
  let setCount = 0;
  let prCount = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      setCount += 1;
      if (s.pr) prCount += 1;
    }
  }
  return { setCount, prCount };
}
