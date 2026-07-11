/**
 * Forge Gazete period aggregation: raw rows (fetched by the loader) → one
 * PeriodAggregates summary the fact extractor consumes. Pure and fully
 * testable; the loader stays a thin query layer.
 *
 * PR counting runs through the shared engine (src/lib/pr) with the same
 * before-the-period frontier the coach weekly report uses, so the Gazete
 * never celebrates a "record" the coach's report wouldn't.
 */
import {
  differenceInCalendarDays,
  differenceInCalendarISOWeeks,
  differenceInCalendarMonths,
  startOfISOWeek,
  startOfMonth,
} from "date-fns";

import { listPrEvents, type DatedPRSet } from "@/lib/pr/count-events";
import {
  KCAL_BAND_HIGH,
  KCAL_BAND_LOW,
  MACRO_FLOOR,
} from "@/lib/reports/nutrition-weekly";
import { parseDateKey } from "@/lib/format";

import type { Period } from "./periods";

/** Raw rows the loader fetches — all constrained to the period (except PR history). */
export type AggregateRows = {
  sessions: { id: string; date: string; completed: boolean }[];
  sets: {
    sessionId: string;
    exerciseId: string;
    exerciseName: string;
    date: string;
    weight: number | null;
    reps: number | null;
    rir: number | null;
  }[];
  /** Exercises with at least one set BEFORE the period (new-exercise detection). */
  historyExerciseIds: Set<string>;
  /** Period sets + up to a year of prior sets, for the PR frontier. */
  prHistorySets: (DatedPRSet & { exerciseId: string; exerciseName: string })[];
  metricDays: {
    date: string;
    weight: number | null;
    sleepHours: number | null;
    steps: number | null;
  }[];
  /** Per-day nutrition totals (already summed per date). */
  mealDays: { date: string; kcal: number; protein: number }[];
  target: { kcal: number | null; protein: number | null } | null;
  cardio: { minutes: number; distanceKm: number | null }[];
  protocol: { due: number; done: number };
  weeklyTargetDays: number | null;
};

export type PeriodAggregates = {
  daysInPeriod: number;
  sessionsCompleted: number;
  totalSets: number;
  tonnageKg: number;
  prCount: number;
  bestPr: { exercise: string; weight: number; reps: number } | null;
  newExercises: string[];
  bestSession: { date: string; sets: number; tonnageKg: number } | null;
  /** Mean of the first/last up-to-3 weigh-ins — noise-trimmed trend anchors. */
  weightFirst: number | null;
  weightLast: number | null;
  weightSamples: number;
  sleepAvg: number | null;
  stepsAvg: number | null;
  proteinDaysHit: number;
  nutritionDaysLogged: number;
  kcalDaysInBand: number;
  cardioMinutes: number;
  cardioDistanceKm: number;
  cardioCount: number;
  protocolDone: number;
  protocolDue: number;
  weeklyTargetDays: number | null;
  /** Lead sparkline: weekly→daily, monthly→ISO-week, milestone→month tonnage. */
  sparkTonnage: number[];
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sparkBuckets(period: Period, sets: AggregateRows["sets"]): number[] {
  const start = parseDateKey(period.start);
  const end = parseDateKey(period.end);
  let count: number;
  let indexOf: (date: string) => number;

  if (period.type === "weekly") {
    count = differenceInCalendarDays(end, start) + 1;
    indexOf = (d) => differenceInCalendarDays(parseDateKey(d), start);
  } else if (period.type === "monthly") {
    const firstWeek = startOfISOWeek(start);
    count = differenceInCalendarISOWeeks(end, firstWeek) + 1;
    indexOf = (d) => differenceInCalendarISOWeeks(parseDateKey(d), firstWeek);
  } else {
    const firstMonth = startOfMonth(start);
    count = differenceInCalendarMonths(end, firstMonth) + 1;
    indexOf = (d) => differenceInCalendarMonths(parseDateKey(d), firstMonth);
  }

  const buckets = new Array<number>(Math.max(count, 1)).fill(0);
  for (const s of sets) {
    if (s.weight == null || s.reps == null) continue;
    const i = indexOf(s.date);
    if (i >= 0 && i < buckets.length) buckets[i] += s.weight * s.reps;
  }
  return buckets;
}

export function aggregatePeriod(
  period: Period,
  rows: AggregateRows,
): PeriodAggregates {
  // ---- Training ----
  let tonnageKg = 0;
  const bySession = new Map<string, { date: string; sets: number; tonnageKg: number }>();
  for (const s of rows.sets) {
    const t = s.weight != null && s.reps != null ? s.weight * s.reps : 0;
    tonnageKg += t;
    const entry = bySession.get(s.sessionId) ?? { date: s.date, sets: 0, tonnageKg: 0 };
    entry.sets += 1;
    entry.tonnageKg += t;
    bySession.set(s.sessionId, entry);
  }
  let bestSession: PeriodAggregates["bestSession"] = null;
  for (const entry of bySession.values()) {
    if (
      !bestSession ||
      entry.tonnageKg > bestSession.tonnageKg ||
      (entry.tonnageKg === bestSession.tonnageKg && entry.sets > bestSession.sets)
    ) {
      bestSession = entry;
    }
  }

  const newExercises: string[] = [];
  const seenNew = new Set<string>();
  for (const s of [...rows.sets].sort((a, b) => a.date.localeCompare(b.date))) {
    if (rows.historyExerciseIds.has(s.exerciseId) || seenNew.has(s.exerciseId)) continue;
    seenNew.add(s.exerciseId);
    newExercises.push(s.exerciseName);
  }

  // ---- PRs (shared engine, per-exercise frontier) ----
  const prByExercise = new Map<string, (DatedPRSet & { exerciseName: string })[]>();
  for (const s of rows.prHistorySets) {
    const list = prByExercise.get(s.exerciseId) ?? [];
    list.push(s);
    prByExercise.set(s.exerciseId, list);
  }
  let prCount = 0;
  let bestPr: PeriodAggregates["bestPr"] = null;
  for (const sets of prByExercise.values()) {
    const events = listPrEvents(sets, period.start, period.end) as (DatedPRSet & {
      exerciseName: string;
    })[];
    prCount += events.length;
    for (const e of events) {
      if (e.weight == null || e.reps == null) continue;
      if (
        !bestPr ||
        e.weight > bestPr.weight ||
        (e.weight === bestPr.weight && e.reps > bestPr.reps)
      ) {
        bestPr = { exercise: e.exerciseName, weight: e.weight, reps: e.reps };
      }
    }
  }

  // ---- Body metrics ----
  const orderedMetrics = [...rows.metricDays].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const weights = orderedMetrics
    .filter((m) => m.weight != null)
    .map((m) => m.weight as number);
  const sleep = orderedMetrics
    .filter((m) => m.sleepHours != null)
    .map((m) => m.sleepHours as number);
  const steps = orderedMetrics
    .filter((m) => m.steps != null)
    .map((m) => m.steps as number);
  const stepsMean = mean(steps);

  // ---- Nutrition ----
  const target = rows.target;
  let proteinDaysHit = 0;
  let kcalDaysInBand = 0;
  for (const day of rows.mealDays) {
    if (target?.protein != null && day.protein >= target.protein * MACRO_FLOOR) {
      proteinDaysHit += 1;
    }
    if (target?.kcal != null) {
      const r = day.kcal / target.kcal;
      if (r >= KCAL_BAND_LOW && r <= KCAL_BAND_HIGH) kcalDaysInBand += 1;
    }
  }

  return {
    daysInPeriod:
      differenceInCalendarDays(parseDateKey(period.end), parseDateKey(period.start)) + 1,
    sessionsCompleted: rows.sessions.filter((s) => s.completed).length,
    totalSets: rows.sets.length,
    tonnageKg,
    prCount,
    bestPr,
    newExercises,
    bestSession,
    weightFirst: mean(weights.slice(0, 3)),
    weightLast: mean(weights.slice(-3)),
    weightSamples: weights.length,
    sleepAvg: mean(sleep),
    stepsAvg: stepsMean == null ? null : Math.round(stepsMean),
    proteinDaysHit,
    nutritionDaysLogged: rows.mealDays.length,
    kcalDaysInBand,
    cardioMinutes: rows.cardio.reduce((a, c) => a + c.minutes, 0),
    cardioDistanceKm: rows.cardio.reduce((a, c) => a + (c.distanceKm ?? 0), 0),
    cardioCount: rows.cardio.length,
    protocolDone: rows.protocol.done,
    protocolDue: rows.protocol.due,
    weeklyTargetDays: rows.weeklyTargetDays,
    sparkTonnage: sparkBuckets(period, rows.sets),
  };
}
