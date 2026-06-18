import { brzycki } from "@/lib/logbook-stats";

import type { ExerciseState, ExerciseStatsLite } from "./types";

/**
 * Whether a freshly-completed set beats the athlete's prior best for this
 * exercise — either on raw weight or estimated 1RM (Brzycki). A first-ever set
 * (no prior history) is not flagged, to keep the PR signal meaningful.
 */
export function detectPr(
  stats: Pick<ExerciseStatsLite, "allTimePr" | "bestEst1RM">,
  set: { weight: number | null; reps: number | null },
): boolean {
  if (set.weight == null || set.reps == null || set.reps <= 0) return false;
  if (stats.allTimePr == null && stats.bestEst1RM == null) return false;

  if (stats.allTimePr != null && set.weight > stats.allTimePr) return true;
  if (stats.bestEst1RM != null && brzycki(set.weight, set.reps) > stats.bestEst1RM) {
    return true;
  }
  return false;
}

export function sessionTotals(exercises: ExerciseState[]): {
  setCount: number;
  volume: number;
  prCount: number;
} {
  let setCount = 0;
  let volume = 0;
  let prCount = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      setCount += 1;
      if (s.pr) prCount += 1;
      if (s.weight != null && s.reps != null && s.reps > 0) {
        volume += s.weight * s.reps;
      }
    }
  }
  return { setCount, volume, prCount };
}
