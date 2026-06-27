/**
 * Coach weekly report aggregator (pure). Splits a week of an athlete's sets by
 * MUSCLE, and within each muscle lists the exercises that trained it with: total
 * set count, the order they were performed in the session, median rest between
 * consecutive sets, and average RIR. Equivalents collapse because grouping is by
 * muscle, not exercise. Volume is set count throughout.
 *
 * Rest and order are derived from performed_at (falling back to created_at), so
 * they reflect the real workout timing the logger captured.
 */
import { round1 } from "@/lib/format";

import type { RegionVolume, TargetRef } from "./session-report";

export type CoachWeekSet = {
  sessionId: string;
  sessionDate: string;
  exerciseId: string;
  exerciseName: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  region: string | null;
  performedAt: string | null;
  createdAt: string;
  targets: TargetRef[];
};

export type CoachExercise = {
  exerciseId: string;
  exerciseName: string;
  /** Sets this week that trained this muscle. */
  sets: number;
  /** Average 1-based position within the session(s) it appeared in. */
  avgOrder: number | null;
  /** Median rest between consecutive sets of this exercise (seconds). */
  restMedianSec: number | null;
  avgRir: number | null;
};

export type CoachMuscle = {
  muscleSlug: string;
  muscleNameTr: string;
  primarySets: number;
  secondarySets: number;
  /** Primary sets broken down by exercise region (sorted desc); [] if none. */
  regions: RegionVolume[];
  exercises: CoachExercise[];
};

export type CoachWeeklyReport = {
  totalSets: number;
  muscles: CoachMuscle[];
};

function timeOf(s: CoachWeekSet): number {
  return new Date(s.performedAt ?? s.createdAt).getTime();
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(m);
}

export function buildCoachWeekly(sets: CoachWeekSet[]): CoachWeeklyReport {
  // ---- Per-session: exercise order + per-exercise rest gaps ----
  const bySession = new Map<string, CoachWeekSet[]>();
  for (const s of sets) {
    if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
    bySession.get(s.sessionId)!.push(s);
  }

  // (sessionId|exerciseId) -> 1-based order within that session.
  const orderKey = (sessionId: string, exId: string) => `${sessionId}|${exId}`;
  const orders = new Map<string, number>();
  // exerciseId -> rest gaps (seconds) across the week.
  const restGaps = new Map<string, number[]>();

  for (const [sessionId, sessionSets] of bySession) {
    // Order: rank exercises by their first set's time.
    const firstSeen = new Map<string, number>();
    for (const s of sessionSets) {
      const t = timeOf(s);
      if (!firstSeen.has(s.exerciseId) || t < firstSeen.get(s.exerciseId)!) {
        firstSeen.set(s.exerciseId, t);
      }
    }
    [...firstSeen.entries()]
      .sort((a, b) => a[1] - b[1])
      .forEach(([exId], i) => orders.set(orderKey(sessionId, exId), i + 1));

    // Rest: consecutive same-exercise gaps within the session.
    const byExercise = new Map<string, CoachWeekSet[]>();
    for (const s of sessionSets) {
      if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
      byExercise.get(s.exerciseId)!.push(s);
    }
    for (const [exId, exSets] of byExercise) {
      const times = exSets.map(timeOf).sort((a, b) => a - b);
      const gaps = restGaps.get(exId) ?? [];
      for (let i = 1; i < times.length; i += 1) gaps.push((times[i] - times[i - 1]) / 1000);
      restGaps.set(exId, gaps);
    }
  }

  // ---- Per muscle -> per exercise accumulation ----
  type ExAcc = {
    exerciseId: string;
    exerciseName: string;
    sets: number;
    rirSum: number;
    rirCount: number;
    sessionOrders: Map<string, number>; // sessionId -> order (deduped)
  };
  type MuscleAcc = {
    muscleSlug: string;
    muscleNameTr: string;
    primarySets: number;
    secondarySets: number;
    regions: Map<string, number>;
    exercises: Map<string, ExAcc>;
  };
  const muscles = new Map<string, MuscleAcc>();

  for (const s of sets) {
    // Distinct muscles this set touched, by role.
    const primary = new Set<string>();
    const secondary = new Set<string>();
    const names = new Map<string, string>();
    for (const t of s.targets) {
      names.set(t.muscleSlug, t.muscleNameTr);
      if (t.role === "primary") primary.add(t.muscleSlug);
      else secondary.add(t.muscleSlug);
    }
    const touched = new Set<string>([...primary, ...secondary]);

    for (const slug of touched) {
      let m = muscles.get(slug);
      if (!m) {
        m = {
          muscleSlug: slug,
          muscleNameTr: names.get(slug)!,
          primarySets: 0,
          secondarySets: 0,
          regions: new Map(),
          exercises: new Map(),
        };
        muscles.set(slug, m);
      }
      if (primary.has(slug)) {
        m.primarySets += 1;
        if (s.region) m.regions.set(s.region, (m.regions.get(s.region) ?? 0) + 1);
      } else m.secondarySets += 1;

      let ex = m.exercises.get(s.exerciseId);
      if (!ex) {
        ex = {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          sets: 0,
          rirSum: 0,
          rirCount: 0,
          sessionOrders: new Map(),
        };
        m.exercises.set(s.exerciseId, ex);
      }
      ex.sets += 1;
      if (s.rir != null) {
        ex.rirSum += s.rir;
        ex.rirCount += 1;
      }
      const order = orders.get(orderKey(s.sessionId, s.exerciseId));
      if (order != null) ex.sessionOrders.set(s.sessionId, order);
    }
  }

  const muscleList: CoachMuscle[] = [...muscles.values()]
    .map((m) => ({
      muscleSlug: m.muscleSlug,
      muscleNameTr: m.muscleNameTr,
      primarySets: m.primarySets,
      secondarySets: m.secondarySets,
      regions: [...m.regions.entries()]
        .map(([region, primarySets]) => ({ region, primarySets }))
        .sort((a, b) => b.primarySets - a.primarySets),
      exercises: [...m.exercises.values()]
        .map((ex) => {
          const orderVals = [...ex.sessionOrders.values()];
          const avgOrder =
            orderVals.length > 0
              ? Math.round(orderVals.reduce((a, b) => a + b, 0) / orderVals.length)
              : null;
          return {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            sets: ex.sets,
            avgOrder,
            restMedianSec: median(restGaps.get(ex.exerciseId) ?? []),
            avgRir: ex.rirCount > 0 ? round1(ex.rirSum / ex.rirCount) : null,
          };
        })
        .sort((a, b) => b.sets - a.sets || (a.avgOrder ?? 99) - (b.avgOrder ?? 99)),
    }))
    .sort(
      (a, b) =>
        b.primarySets - a.primarySets ||
        b.secondarySets - a.secondarySets ||
        a.muscleNameTr.localeCompare(b.muscleNameTr, "tr"),
    );

  return { totalSets: sets.length, muscles: muscleList };
}
