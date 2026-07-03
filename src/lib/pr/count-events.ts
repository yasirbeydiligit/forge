/**
 * Count STRENGTH PR events (weight/reps/both/tradeoff — RIR-only excluded)
 * among one exercise's sets inside a date range, judging each set against the
 * full history strictly before it (including sets before the range, so an old
 * achievement never counts as a new record). Shared by the training-progress
 * report and the weekly muscle report's PR column.
 */
import { evaluatePR, type PRSet } from "./evaluate-pr";

export type DatedPRSet = PRSet & { date: string };

const STRENGTH_PR = new Set(["weight", "reps", "both", "tradeoff"]);

export function countPrEvents(
  sets: DatedPRSet[],
  from: string,
  to?: string,
): number {
  const ordered = [...sets].sort((a, b) => a.date.localeCompare(b.date));
  let count = 0;
  const history: PRSet[] = [];
  for (const s of ordered) {
    const inRange = s.date >= from && (to == null || s.date <= to);
    if (inRange) {
      const result = evaluatePR(s, history);
      if (result.isPR && result.type && STRENGTH_PR.has(result.type)) count += 1;
    }
    history.push({ weight: s.weight, reps: s.reps, rir: s.rir });
  }
  return count;
}
