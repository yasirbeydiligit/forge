/**
 * Forge Gazete fact extraction — turns a period's aggregates into candidate
 * news items ("facts") and gentle editor-note candidates ("cautions").
 *
 * Honesty is structural: every praise threshold is an exported constant, a
 * fact below its threshold is simply never created, and a change that runs
 * AGAINST the athlete's goal can only become a caution — never praise. The
 * negative side of coaching lives with the coach; the Gazete stays honest by
 * saying less, not by spinning.
 */
import type { PeriodAggregates } from "./aggregate";

export type FactType =
  | "pr_count"
  | "volume_trend"
  | "consistency"
  | "weight_trend"
  | "protein_consistency"
  | "sleep_improvement"
  | "steps_avg"
  | "cardio_total"
  | "protocol_adherence"
  | "new_exercises"
  | "best_session";

export type Fact = {
  type: FactType;
  /** News value — headline/story selection sorts on this. */
  score: number;
  direction: "positive" | "neutral";
  /** Template slots — copy.ts fillTemplate consumes these. */
  slots: Record<string, string | number>;
  /** 0..1 fill bar shown on the story card (when meaningful). */
  fill?: number;
};

export type Caution = {
  type: "weight_against_goal" | "sleep_decline" | "protein_low";
  slots: Record<string, string | number>;
  severity: number;
};

export type TrainingGoal = "muscle_gain" | "strength" | "fat_loss" | "maintenance";

// ---- Praise thresholds (honesty constants; praise below these is impossible) ----
export const CONSISTENCY_PRAISE_RATIO = 0.8;
export const WEIGHT_TREND_MIN_KG = 0.4;
export const WEIGHT_MIN_SAMPLES = 4;
export const MAINTENANCE_STABLE_KG = 0.5;
export const PROTEIN_PRAISE_RATIO = 0.8;
export const NUTRITION_MIN_LOGGED_DAYS = 4;
export const SLEEP_IMPROVE_MIN_H = 0.3;
export const SLEEP_DECLINE_MIN_H = 0.5;
export const SLEEP_MIN_SAMPLES = 4;
export const VOLUME_TREND_MIN_RATIO = 1.1;
export const PROTOCOL_PRAISE_RATIO = 0.85;
export const CARDIO_MIN_MINUTES_WEEKLY = 60;
export const CARDIO_MIN_MINUTES_LONG = 240;
export const STEPS_MIN_AVG = 7000;

// ---- Base scores (magnitude multipliers applied on top) ----
const SCORE = {
  pr_count: 50,
  weight_trend: 40,
  consistency: 35,
  volume_trend: 30,
  protein_consistency: 25,
  sleep_improvement: 20,
  cardio_total: 18,
  protocol_adherence: 16,
  new_exercises: 14,
  steps_avg: 12,
  best_session: 10,
} satisfies Record<FactType, number>;

/** Milestone issues put the long-run body change front and center. */
const MILESTONE_WEIGHT_BOOST = 1.5;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function extractFacts(input: {
  goal: TrainingGoal | null;
  periodType: "weekly" | "monthly" | "milestone";
  current: PeriodAggregates;
  previous: PeriodAggregates | null;
}): { facts: Fact[]; cautions: Caution[] } {
  const { goal, periodType, current: cur, previous: prev } = input;
  const facts: Fact[] = [];
  const cautions: Caution[] = [];

  // Fixed Turkish period words — safe to inflect since they are not dynamic.
  const periodWord = { weekly: "hafta", monthly: "ay", milestone: "dönem" }[periodType];
  const periodGen = { weekly: "haftanın", monthly: "ayın", milestone: "dönemin" }[periodType];
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1);
  const periodSlots = {
    period: periodWord,
    periodCap: cap(periodWord),
    periodGen,
    periodGenCap: cap(periodGen),
  };

  // ---- PRs ----
  if (cur.prCount > 0 && cur.bestPr) {
    facts.push({
      type: "pr_count",
      score: SCORE.pr_count + Math.min(cur.prCount, 10) * 6,
      direction: "positive",
      slots: {
        ...periodSlots,
        count: cur.prCount,
        exercise: cur.bestPr.exercise,
        weight: cur.bestPr.weight,
        reps: cur.bestPr.reps,
      },
    });
  }

  // ---- Weight trend (goal-aware; against-goal can only become a caution) ----
  if (
    cur.weightFirst != null &&
    cur.weightLast != null &&
    cur.weightSamples >= WEIGHT_MIN_SAMPLES
  ) {
    const delta = round1(cur.weightLast - cur.weightFirst);
    const abs = Math.abs(delta);
    const boost = periodType === "milestone" ? MILESTONE_WEIGHT_BOOST : 1;
    const slots = {
      ...periodSlots,
      deltaKg: abs,
      direction: delta < 0 ? "düşüş" : "artış",
      from: round1(cur.weightFirst),
      to: round1(cur.weightLast),
    };
    if (goal === "maintenance") {
      if (abs <= MAINTENANCE_STABLE_KG) {
        facts.push({
          type: "weight_trend",
          score: SCORE.weight_trend * boost,
          direction: "positive",
          slots: { ...slots, direction: "korundu", deltaKg: abs },
        });
      } else {
        cautions.push({
          type: "weight_against_goal",
          slots,
          severity: abs,
        });
      }
    } else if (abs >= WEIGHT_TREND_MIN_KG) {
      const wanted =
        goal === "fat_loss" ? delta < 0 : goal != null ? delta > 0 : null;
      if (wanted === null) {
        facts.push({
          type: "weight_trend",
          score: SCORE.weight_trend,
          direction: "neutral",
          slots,
        });
      } else if (wanted) {
        facts.push({
          type: "weight_trend",
          score: (SCORE.weight_trend + Math.min(abs, 5) * 8) * boost,
          direction: "positive",
          slots,
        });
      } else {
        cautions.push({ type: "weight_against_goal", slots, severity: abs });
      }
    }
  }

  // ---- Consistency vs the athlete's own weekly target ----
  if (cur.weeklyTargetDays != null && cur.weeklyTargetDays > 0) {
    const weeks = cur.daysInPeriod / 7;
    const planned = Math.round(cur.weeklyTargetDays * weeks);
    if (planned > 0 && cur.sessionsTrained / planned >= CONSISTENCY_PRAISE_RATIO) {
      const ratio = cur.sessionsTrained / planned;
      facts.push({
        type: "consistency",
        score: SCORE.consistency + Math.min(ratio, 1.2) * 20,
        direction: "positive",
        slots: { ...periodSlots, sessions: cur.sessionsTrained, planned },
        fill: Math.min(ratio, 1),
      });
    }
  }

  // ---- Volume trend (set count, per app-wide decision; needs a real previous) ----
  if (prev && prev.totalSets > 0 && cur.totalSets / prev.totalSets >= VOLUME_TREND_MIN_RATIO) {
    const percent = Math.round((cur.totalSets / prev.totalSets - 1) * 100);
    facts.push({
      type: "volume_trend",
      score: SCORE.volume_trend + Math.min(percent, 50) / 2,
      direction: "positive",
      slots: { ...periodSlots, percent, sets: cur.totalSets },
    });
  }

  // ---- Nutrition consistency ----
  if (cur.nutritionDaysLogged >= NUTRITION_MIN_LOGGED_DAYS) {
    const ratio = cur.proteinDaysHit / cur.nutritionDaysLogged;
    if (ratio >= PROTEIN_PRAISE_RATIO) {
      facts.push({
        type: "protein_consistency",
        score: SCORE.protein_consistency + ratio * 15,
        direction: "positive",
        slots: { ...periodSlots, hit: cur.proteinDaysHit, logged: cur.nutritionDaysLogged },
        fill: ratio,
      });
    } else if (ratio < 0.5) {
      cautions.push({
        type: "protein_low",
        slots: { hit: cur.proteinDaysHit, logged: cur.nutritionDaysLogged },
        severity: 0.5 - ratio,
      });
    }
  }

  // ---- Sleep (vs previous period) ----
  if (cur.sleepAvg != null && prev?.sleepAvg != null) {
    const delta = round1(cur.sleepAvg - prev.sleepAvg);
    if (delta >= SLEEP_IMPROVE_MIN_H) {
      facts.push({
        type: "sleep_improvement",
        score: SCORE.sleep_improvement + delta * 10,
        direction: "positive",
        slots: { ...periodSlots, delta, avg: round1(cur.sleepAvg) },
      });
    } else if (delta <= -SLEEP_DECLINE_MIN_H) {
      cautions.push({
        type: "sleep_decline",
        slots: { delta: Math.abs(delta), avg: round1(cur.sleepAvg) },
        severity: Math.abs(delta),
      });
    }
  }

  // ---- Steps ----
  if (cur.stepsAvg != null && cur.stepsAvg >= STEPS_MIN_AVG) {
    facts.push({
      type: "steps_avg",
      score: SCORE.steps_avg + Math.min(cur.stepsAvg / 1000, 15),
      direction: "positive",
      slots: { ...periodSlots, avg: cur.stepsAvg },
    });
  }

  // ---- Cardio ----
  const cardioFloor =
    periodType === "weekly" ? CARDIO_MIN_MINUTES_WEEKLY : CARDIO_MIN_MINUTES_LONG;
  if (cur.cardioMinutes >= cardioFloor) {
    facts.push({
      type: "cardio_total",
      score: SCORE.cardio_total + Math.min(cur.cardioMinutes / 30, 20),
      direction: "positive",
      slots: {
        ...periodSlots,
        minutes: cur.cardioMinutes,
        count: cur.cardioCount,
        distance: round1(cur.cardioDistanceKm),
      },
    });
  }

  // ---- Protocol adherence ----
  if (cur.protocolDue > 0) {
    const ratio = cur.protocolDone / cur.protocolDue;
    if (ratio >= PROTOCOL_PRAISE_RATIO) {
      facts.push({
        type: "protocol_adherence",
        score: SCORE.protocol_adherence + ratio * 10,
        direction: "positive",
        slots: { ...periodSlots, done: cur.protocolDone, due: cur.protocolDue },
        fill: Math.min(ratio, 1),
      });
    }
  }

  // ---- New exercises ----
  if (cur.newExercises.length > 0) {
    facts.push({
      type: "new_exercises",
      score: SCORE.new_exercises + Math.min(cur.newExercises.length, 5) * 3,
      direction: "positive",
      slots: { ...periodSlots, count: cur.newExercises.length, first: cur.newExercises[0] },
    });
  }

  // ---- Best session ----
  if (cur.bestSession && cur.bestSession.sets > 0 && cur.sessionsTrained > 1) {
    facts.push({
      type: "best_session",
      score: SCORE.best_session,
      direction: "positive",
      slots: { ...periodSlots, date: cur.bestSession.date, sets: cur.bestSession.sets },
    });
  }

  facts.sort((a, b) => b.score - a.score);
  cautions.sort((a, b) => b.severity - a.severity);
  return { facts, cautions };
}
