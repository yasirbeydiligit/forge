/**
 * Logbook analytics — pure functions computed from an athlete's historical
 * sets for a single exercise. Used to power VS LAST, the observed all-time
 * heaviest set, recent history, 4-week set-count volume / RIR and trend.
 *
 * Note: "volume" in this product is SET COUNT, never tonnage (kg×reps), and PRs
 * are observed (no estimated-1RM formulas). See src/lib/pr/evaluate-pr.ts.
 */
import { round1 } from "@/lib/format";
import { prFrontier, type PRSet } from "@/lib/pr/evaluate-pr";

export type HistorySetRow = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  set_number: number;
  exercise_id: string;
  created_at: string;
  session_date: string;
};

export type SessionSummary = {
  date: string;
  topWeight: number;
  scheme: string; // e.g. "3 × 5 @ 80"
  setCount: number;
  avgRir: number | null;
};

export type ExerciseStats = {
  /** Heaviest weight ever lifted (observed, not a formula). */
  allTimePr: number | null;
  allTimePrDate: string | null;
  /** Number of sets in the trailing 28 days (set-count volume). */
  volumeSets4w: number;
  avgRir4w: number | null;
  /** Non-dominated (weight,reps) frontier of all sets, for the PR engine. */
  prHistory: PRSet[];
  recentSessions: SessionSummary[]; // newest first, max 4
  /** Best top-weight delta across the 28-day window (kg). */
  trendDelta: number | null;
  /** Sparkline points: top weight per session, oldest → newest. */
  trendPoints: number[];
  /** Previous session's set weights, ordered by set number (for VS LAST). */
  prevSessionWeights: number[];
  /** Previous session's sets (weight + reps), ordered by set number. Powers
   * last-entered placeholders and the session summary's set-by-set comparison. */
  prevSessionSets: { weight: number; reps: number | null }[];
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Set-count volume = number of sets with a usable weight & reps. This product
 * measures volume in SETS, not tonnage; reuse this instead of counting inline.
 */
export function setsCount(sets: HistorySetRow[]): number {
  return sets.filter(
    (s) => s.weight != null && s.reps != null && (s.reps as number) > 0,
  ).length;
}

/**
 * Mean RIR across the given sets (ignoring sets without an RIR), or null when
 * none have one. Single source of truth for "average RIR".
 */
export function setsAvgRir(sets: HistorySetRow[]): number | null {
  const rirs = sets.map((s) => s.rir).filter((r): r is number => r != null);
  if (rirs.length === 0) return null;
  return rirs.reduce((a, b) => a + Number(b), 0) / rirs.length;
}

function groupBySession(rows: HistorySetRow[]) {
  const map = new Map<string, HistorySetRow[]>();
  for (const r of rows) {
    if (!map.has(r.session_date)) map.set(r.session_date, []);
    map.get(r.session_date)!.push(r);
  }
  return map;
}

function summariseSession(date: string, sets: HistorySetRow[]): SessionSummary {
  const valid = sets.filter((s) => s.weight != null && s.reps != null);
  const topWeight = valid.reduce((m, s) => Math.max(m, Number(s.weight)), 0);
  const meanRir = setsAvgRir(valid);
  const avgRir = meanRir != null ? round1(meanRir) : null;

  // Compact scheme using the most common reps at the top weight.
  const topSets = valid.filter((s) => Number(s.weight) === topWeight);
  const reps = topSets[0]?.reps ?? valid[0]?.reps ?? null;
  const scheme =
    topWeight > 0 && reps != null
      ? `${topSets.length || valid.length} × ${reps} @ ${round1(topWeight)}`
      : `${valid.length} set`;

  return { date, topWeight: round1(topWeight), scheme, setCount: valid.length, avgRir };
}

export function computeExerciseStats(
  rows: HistorySetRow[],
  todayDate: string,
): ExerciseStats {
  const valid = rows.filter(
    (r) => r.weight != null && r.reps != null && (r.reps as number) > 0,
  );

  // All-time heaviest observed set (no estimated-1RM formula).
  let allTimePr: number | null = null;
  let allTimePrDate: string | null = null;
  for (const s of valid) {
    const w = Number(s.weight);
    if (allTimePr == null || w > allTimePr) {
      allTimePr = w;
      allTimePrDate = s.session_date;
    }
  }

  // PR frontier across all valid sets, for the observed-performance PR engine.
  const prHistory = prFrontier(
    valid.map((s) => ({ weight: Number(s.weight), reps: s.reps, rir: s.rir })),
  );

  // 4-week (28-day) window relative to the day being viewed.
  const todayMs = new Date(todayDate).getTime();
  const windowStart = todayMs - 28 * DAY;
  const inWindow = valid.filter(
    (s) => new Date(s.session_date).getTime() >= windowStart,
  );
  const volumeSets4w = setsCount(inWindow);
  const meanRir4w = setsAvgRir(inWindow);
  const avgRir4w = meanRir4w != null ? round1(meanRir4w) : null;

  // Sessions newest → oldest.
  const bySession = groupBySession(valid);
  const sessionDates = [...bySession.keys()].sort((a, b) =>
    b.localeCompare(a),
  );
  const recentSessions = sessionDates
    .slice(0, 4)
    .map((d) => summariseSession(d, bySession.get(d)!));

  // Trend across the window: oldest → newest top weights.
  const windowSessions = sessionDates
    .filter((d) => new Date(d).getTime() >= windowStart)
    .sort((a, b) => a.localeCompare(b));
  const trendPoints = windowSessions.map((d) =>
    summariseSession(d, bySession.get(d)!).topWeight,
  );
  const trendDelta =
    trendPoints.length >= 2
      ? round1(trendPoints[trendPoints.length - 1] - trendPoints[0])
      : null;

  // Previous session (strictly before today) → set weights ordered by set number.
  const prevDate = sessionDates.find((d) => d.localeCompare(todayDate) < 0);
  const prevSessionWeights: number[] = [];
  const prevSessionSets: { weight: number; reps: number | null }[] = [];
  if (prevDate) {
    const prevSets = bySession
      .get(prevDate)!
      .filter((s) => s.weight != null)
      .sort((a, b) => a.set_number - b.set_number);
    for (const s of prevSets) {
      prevSessionWeights.push(Number(s.weight));
      prevSessionSets.push({ weight: Number(s.weight), reps: s.reps });
    }
  }

  return {
    allTimePr: allTimePr != null ? round1(allTimePr) : null,
    allTimePrDate,
    volumeSets4w,
    avgRir4w,
    prHistory,
    recentSessions,
    trendDelta,
    trendPoints,
    prevSessionWeights,
    prevSessionSets,
  };
}
