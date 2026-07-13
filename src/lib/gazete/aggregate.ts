/**
 * Forge Gazete period aggregation: raw rows (fetched by the loader) → one
 * PeriodAggregates summary consumed by the fact extractor and the section
 * builder. Pure and fully testable; the loader stays a thin query layer.
 *
 * Conventions shared with the rest of the product:
 * - Volume is SET COUNT everywhere (tonnage was deliberately removed).
 * - Muscle set counting matches the coach weekly report: a set counts for a
 *   muscle once (even when two functions of the same muscle are targeted),
 *   and the per-muscle table counts PRIMARY targets only.
 * - PR counting runs through the shared engine (src/lib/pr) with the same
 *   before-the-period frontier, so the Gazete never celebrates a "record"
 *   the coach's report wouldn't.
 */
import {
  differenceInCalendarDays,
  differenceInCalendarISOWeeks,
  differenceInCalendarMonths,
  startOfISOWeek,
  startOfMonth,
} from "date-fns";

import { listPrEvents, type DatedPRSet } from "@/lib/pr/count-events";
import type { MetricKey } from "@/lib/metrics";
import {
  KCAL_BAND_HIGH,
  KCAL_BAND_LOW,
  MACRO_FLOOR,
} from "@/lib/reports/nutrition-weekly";
import { parseDateKey, round1 } from "@/lib/format";

import type { Period } from "./periods";

export type SetMuscleRef = {
  slug: string;
  nameTr: string;
  role: "primary" | "secondary";
};

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
    region: string | null;
    muscles: SetMuscleRef[];
  }[];
  /** Exercises with at least one set BEFORE the period (new-exercise detection). */
  historyExerciseIds: Set<string>;
  /** Period sets + up to a year of prior sets, for the PR frontier. */
  prHistorySets: (DatedPRSet & {
    exerciseId: string;
    exerciseName: string;
    region: string | null;
  })[];
  metricDays: {
    date: string;
    weight: number | null;
    sleepHours: number | null;
    restingHr: number | null;
    energy: number | null;
    hunger: number | null;
    adherence: number | null;
    digestion: number | null;
    steps: number | null;
    waterMl: number | null;
  }[];
  /** Per-day nutrition totals (already summed per date). */
  mealDays: { date: string; kcal: number; protein: number; carbs: number; fat: number }[];
  target: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    waterMl: number | null;
  } | null;
  cardio: { minutes: number; distanceKm: number | null }[];
  protocol: { due: number; done: number };
  weeklyTargetDays: number | null;
};

/** Numeric tracker metrics the Gazete averages ("notes" excluded). */
export type NumericMetricKey = Exclude<MetricKey, "notes">;

export type PeriodAggregates = {
  daysInPeriod: number;
  // ---- Training ----
  sessionsCompleted: number;
  totalSets: number;
  setsPerSession: number | null;
  avgRir: number | null;
  prCount: number;
  bestPr: { exercise: string; weight: number; reps: number } | null;
  /** PR events grouped by the exercise's region (desc; null region → "Diğer"). */
  prRegions: { region: string; count: number }[];
  /** Primary-target sets per muscle (Turkish name, desc). */
  muscleSets: { muscle: string; sets: number }[];
  /** Sets per exercise region (desc; region-less sets skipped). */
  regionSets: { region: string; sets: number }[];
  newExercises: string[];
  bestSession: { date: string; sets: number } | null;
  /** Lead sparkline: weekly→daily, monthly→ISO-week, milestone→month SET counts. */
  sparkSets: number[];
  // ---- Body metrics ----
  /** Mean of the first/last up-to-3 weigh-ins — noise-trimmed trend anchors. */
  weightFirst: number | null;
  weightLast: number | null;
  weightSamples: number;
  sleepAvg: number | null;
  stepsAvg: number | null;
  /** Per-metric period averages; a key is present only when logged ≥1 day. */
  metricAvgs: Partial<Record<NumericMetricKey, number>>;
  waterAvgMl: number | null;
  waterDaysLogged: number;
  /** Days the water goal (nutrition_targets.water_ml) was reached; 0 without a goal. */
  waterGoalDays: number;
  // ---- Nutrition ----
  nutritionDaysLogged: number;
  kcalAvg: number | null;
  proteinAvg: number | null;
  carbsAvg: number | null;
  fatAvg: number | null;
  kcalDaysInBand: number;
  kcalDaysOver: number;
  kcalDaysUnder: number;
  proteinDaysHit: number;
  targetKcal: number | null;
  targetProtein: number | null;
  targetWaterMl: number | null;
  // ---- Cardio & protocol ----
  cardioMinutes: number;
  cardioDistanceKm: number;
  cardioCount: number;
  protocolDone: number;
  protocolDue: number;
  weeklyTargetDays: number | null;
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
    const i = indexOf(s.date);
    if (i >= 0 && i < buckets.length) buckets[i] += 1;
  }
  return buckets;
}

function descCounts<T extends string>(map: Map<T, number>) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function aggregatePeriod(
  period: Period,
  rows: AggregateRows,
): PeriodAggregates {
  // ---- Training (volume is set count, per the app-wide product decision) ----
  const bySession = new Map<string, { date: string; sets: number }>();
  const muscleCount = new Map<string, number>();
  const regionCount = new Map<string, number>();
  const rirValues: number[] = [];
  for (const s of rows.sets) {
    const entry = bySession.get(s.sessionId) ?? { date: s.date, sets: 0 };
    entry.sets += 1;
    bySession.set(s.sessionId, entry);

    if (s.rir != null) rirValues.push(s.rir);
    if (s.region) regionCount.set(s.region, (regionCount.get(s.region) ?? 0) + 1);

    // A muscle counts once per set even when two of its functions are hit.
    const seen = new Set<string>();
    for (const m of s.muscles) {
      if (m.role !== "primary" || seen.has(m.slug)) continue;
      seen.add(m.slug);
      muscleCount.set(m.nameTr, (muscleCount.get(m.nameTr) ?? 0) + 1);
    }
  }
  let bestSession: PeriodAggregates["bestSession"] = null;
  for (const entry of bySession.values()) {
    if (!bestSession || entry.sets > bestSession.sets) bestSession = entry;
  }

  const newExercises: string[] = [];
  const seenNew = new Set<string>();
  for (const s of [...rows.sets].sort((a, b) => a.date.localeCompare(b.date))) {
    if (rows.historyExerciseIds.has(s.exerciseId) || seenNew.has(s.exerciseId)) continue;
    seenNew.add(s.exerciseId);
    newExercises.push(s.exerciseName);
  }

  // ---- PRs (shared engine, per-exercise frontier) ----
  type PrRow = AggregateRows["prHistorySets"][number];
  const prByExercise = new Map<string, PrRow[]>();
  for (const s of rows.prHistorySets) {
    const list = prByExercise.get(s.exerciseId) ?? [];
    list.push(s);
    prByExercise.set(s.exerciseId, list);
  }
  let prCount = 0;
  let bestPr: PeriodAggregates["bestPr"] = null;
  const prRegionCount = new Map<string, number>();
  for (const sets of prByExercise.values()) {
    const events = listPrEvents(sets, period.start, period.end) as PrRow[];
    prCount += events.length;
    for (const e of events) {
      const region = e.region ?? "Diğer";
      prRegionCount.set(region, (prRegionCount.get(region) ?? 0) + 1);
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
  const series: Record<NumericMetricKey, number[]> = {
    weight: [],
    sleep_hours: [],
    resting_hr: [],
    energy: [],
    hunger: [],
    adherence: [],
    digestion: [],
    steps: [],
  };
  const water: number[] = [];
  for (const m of orderedMetrics) {
    if (m.weight != null) series.weight.push(m.weight);
    if (m.sleepHours != null) series.sleep_hours.push(m.sleepHours);
    if (m.restingHr != null) series.resting_hr.push(m.restingHr);
    if (m.energy != null) series.energy.push(m.energy);
    if (m.hunger != null) series.hunger.push(m.hunger);
    if (m.adherence != null) series.adherence.push(m.adherence);
    if (m.digestion != null) series.digestion.push(m.digestion);
    if (m.steps != null) series.steps.push(m.steps);
    if (m.waterMl != null) water.push(m.waterMl);
  }
  const metricAvgs: PeriodAggregates["metricAvgs"] = {};
  for (const key of Object.keys(series) as NumericMetricKey[]) {
    const avg = mean(series[key]);
    if (avg != null) metricAvgs[key] = avg;
  }
  const waterAvg = mean(water);
  const targetWaterMl = rows.target?.waterMl ?? null;
  const waterGoalDays =
    targetWaterMl != null ? water.filter((v) => v >= targetWaterMl).length : 0;

  // ---- Nutrition ----
  const target = rows.target;
  let proteinDaysHit = 0;
  let kcalDaysInBand = 0;
  let kcalDaysOver = 0;
  let kcalDaysUnder = 0;
  for (const day of rows.mealDays) {
    if (target?.protein != null && day.protein >= target.protein * MACRO_FLOOR) {
      proteinDaysHit += 1;
    }
    if (target?.kcal != null) {
      const r = day.kcal / target.kcal;
      if (r > KCAL_BAND_HIGH) kcalDaysOver += 1;
      else if (r < KCAL_BAND_LOW) kcalDaysUnder += 1;
      else kcalDaysInBand += 1;
    }
  }
  const avgOf = (pick: (d: AggregateRows["mealDays"][number]) => number) => {
    const v = mean(rows.mealDays.map(pick));
    return v == null ? null : Math.round(v);
  };

  const sessionsCompleted = rows.sessions.filter((s) => s.completed).length;
  const totalSets = rows.sets.length;
  const stepsMean = mean(series.steps);

  return {
    daysInPeriod:
      differenceInCalendarDays(parseDateKey(period.end), parseDateKey(period.start)) + 1,
    sessionsCompleted,
    totalSets,
    setsPerSession:
      sessionsCompleted > 0 ? round1(totalSets / sessionsCompleted) : null,
    avgRir: rirValues.length > 0 ? round1(mean(rirValues)!) : null,
    prCount,
    bestPr,
    prRegions: descCounts(prRegionCount).map(([region, count]) => ({ region, count })),
    muscleSets: descCounts(muscleCount).map(([muscle, sets]) => ({ muscle, sets })),
    regionSets: descCounts(regionCount).map(([region, sets]) => ({ region, sets })),
    newExercises,
    bestSession,
    sparkSets: sparkBuckets(period, rows.sets),
    weightFirst: mean(series.weight.slice(0, 3)),
    weightLast: mean(series.weight.slice(-3)),
    weightSamples: series.weight.length,
    sleepAvg: mean(series.sleep_hours),
    stepsAvg: stepsMean == null ? null : Math.round(stepsMean),
    metricAvgs,
    waterAvgMl: waterAvg == null ? null : Math.round(waterAvg),
    waterDaysLogged: water.length,
    waterGoalDays,
    nutritionDaysLogged: rows.mealDays.length,
    kcalAvg: avgOf((d) => d.kcal),
    proteinAvg: avgOf((d) => d.protein),
    carbsAvg: avgOf((d) => d.carbs),
    fatAvg: avgOf((d) => d.fat),
    kcalDaysInBand,
    kcalDaysOver,
    kcalDaysUnder,
    proteinDaysHit,
    targetKcal: target?.kcal ?? null,
    targetProtein: target?.protein ?? null,
    targetWaterMl,
    cardioMinutes: rows.cardio.reduce((a, c) => a + c.minutes, 0),
    cardioDistanceKm: rows.cardio.reduce((a, c) => a + (c.distanceKm ?? 0), 0),
    cardioCount: rows.cardio.length,
    protocolDone: rows.protocol.done,
    protocolDue: rows.protocol.due,
    weeklyTargetDays: rows.weeklyTargetDays,
  };
}
