/**
 * Plateau / stagnation detector (pure). A soft, coach-facing "attention" signal
 * — NOT a hard alarm. Over the last N sessions of an exercise, if nothing
 * improved in weight, reps, or RIR, we flag a stall. Some isolation work
 * naturally progresses slowly, so the UI copy stays gentle.
 *
 * This is the simple N-session rule; the window is configurable so a coach can
 * tune sensitivity later.
 */

export type PlateauConfig = {
  /** How many recent sessions must show no progress to flag a stall. */
  sessions: number;
};

export const PLATEAU_CONFIG: PlateauConfig = { sessions: 3 };

export type PlateauSessionStat = {
  date: string;
  topWeight: number;
  topReps: number;
  /** Lowest (best) RIR that session; null when none was recorded. */
  bestRir: number | null;
};

/** True if `b` improved over `a` in weight, reps, or RIR (lower = better). */
function improved(a: PlateauSessionStat, b: PlateauSessionStat): boolean {
  if (b.topWeight > a.topWeight) return true;
  if (b.topReps > a.topReps) return true;
  if (a.bestRir != null && b.bestRir != null && b.bestRir < a.bestRir) return true;
  return false;
}

export function detectPlateau(
  stats: PlateauSessionStat[],
  config?: Partial<PlateauConfig>,
): { stalled: boolean; sessions: number } {
  const n = config?.sessions ?? PLATEAU_CONFIG.sessions;
  const sorted = [...stats].sort((a, b) => a.date.localeCompare(b.date));
  const window = sorted.slice(-n);

  // Not enough history to judge a stall.
  if (window.length < n) return { stalled: false, sessions: window.length };

  for (let i = 1; i < window.length; i += 1) {
    if (improved(window[i - 1], window[i])) {
      return { stalled: false, sessions: window.length };
    }
  }
  return { stalled: true, sessions: window.length };
}
