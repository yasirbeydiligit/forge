/**
 * Coach-facing training PROGRESS report (pure). Answers the questions a coach
 * actually asks — not "what sets were logged" but:
 *
 *   - How many PRs, in how many exercises? What are the trends?
 *   - Per exercise: where did it start, where is it now (top set → top set)?
 *   - Which muscle (category) and which of its regions moved forward?
 *   - Any anomalies — strange drops from the recent best?
 *
 * PR events reuse the phase-2 engine (evaluatePR): every in-window set is
 * judged against the FULL prior history (including pre-window sets), so a
 * weight already achieved months ago never counts as a new record. Only
 * strength PR types count here; RIR-only PRs are deliberately excluded.
 */
import { countPrEvents } from "@/lib/pr/count-events";

export type TrainingProgressConfig = {
  /** Last top set at/below (1 - ratio) × window-best top weight ⇒ anomaly. */
  anomalyDropRatio: number;
  /** Minimum in-window sessions before an anomaly can be called. */
  anomalyMinSessions: number;
};

export const TRAINING_PROGRESS_CONFIG: TrainingProgressConfig = {
  anomalyDropRatio: 0.15,
  anomalyMinSessions: 3,
};

export type ProgressSet = {
  /** Session date (ISO yyyy-mm-dd). */
  date: string;
  exerciseId: string;
  exerciseName: string;
  /** Finer sub-region label from the exercise (e.g. "Üst Göğüs"). */
  region: string | null;
  /** PRIMARY muscle targets of the exercise. */
  muscles: { slug: string; nameTr: string }[];
  weight: number | null;
  reps: number | null;
  rir: number | null;
};

export type TopSet = { date: string; weight: number; reps: number };

export type ExerciseProgress = {
  exerciseId: string;
  exerciseName: string;
  /** Distinct in-window session dates. */
  sessions: number;
  firstTop: TopSet;
  lastTop: TopSet;
  bestTop: TopSet;
  /** Strength PR events (weight/reps/both/tradeoff) inside the window. */
  prCount: number;
  trend: "up" | "down" | "flat" | "none";
  /** Last session's top set fell sharply below the window best. */
  anomaly: boolean;
};

export type RegionProgress = {
  region: string | null;
  exercises: ExerciseProgress[];
};

export type MuscleProgress = {
  muscleSlug: string;
  muscleNameTr: string;
  regions: RegionProgress[];
};

export type TrainingProgressReport = {
  /** Distinct in-window session dates across all exercises. */
  sessionCount: number;
  exercisesTotal: number;
  exercisesWithPR: number;
  totalPRs: number;
  anomalyCount: number;
  muscles: MuscleProgress[];
};

function topOf(sets: ProgressSet[], date: string): TopSet {
  let best: ProgressSet | null = null;
  for (const s of sets) {
    if (s.weight == null || s.reps == null) continue;
    if (
      !best ||
      s.weight > best.weight! ||
      (s.weight === best.weight && s.reps > best.reps!)
    ) {
      best = s;
    }
  }
  return { date, weight: best?.weight ?? 0, reps: best?.reps ?? 0 };
}

export function buildTrainingProgress(
  sets: ProgressSet[],
  windowStart: string,
  config: TrainingProgressConfig = TRAINING_PROGRESS_CONFIG,
): TrainingProgressReport {
  // ---- Per exercise, chronological ----------------------------------------
  const byExercise = new Map<string, ProgressSet[]>();
  for (const s of sets) {
    if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
    byExercise.get(s.exerciseId)!.push(s);
  }

  const exercises: (ExerciseProgress & {
    meta: Pick<ProgressSet, "region" | "muscles">;
  })[] = [];
  const windowDates = new Set<string>();

  for (const all of byExercise.values()) {
    const ordered = [...all].sort((a, b) => a.date.localeCompare(b.date));
    const inWindow = ordered.filter((s) => s.date >= windowStart);
    if (inWindow.length === 0) continue;

    // PR events: each in-window set vs everything strictly before it.
    const prCount = countPrEvents(ordered, windowStart);

    // Top set per in-window session date.
    const byDate = new Map<string, ProgressSet[]>();
    for (const s of inWindow) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date)!.push(s);
      windowDates.add(s.date);
    }
    const dates = [...byDate.keys()].sort();
    const tops = dates.map((d) => topOf(byDate.get(d)!, d));
    const firstTop = tops[0];
    const lastTop = tops[tops.length - 1];
    const bestTop = tops.reduce((a, b) =>
      b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a,
    );

    const trend: ExerciseProgress["trend"] =
      tops.length < 2
        ? "none"
        : lastTop.weight !== firstTop.weight
          ? lastTop.weight > firstTop.weight
            ? "up"
            : "down"
          : lastTop.reps !== firstTop.reps
            ? lastTop.reps > firstTop.reps
              ? "up"
              : "down"
            : "flat";

    const anomaly =
      tops.length >= config.anomalyMinSessions &&
      lastTop.weight <= bestTop.weight * (1 - config.anomalyDropRatio);

    const latest = inWindow[inWindow.length - 1];
    exercises.push({
      exerciseId: latest.exerciseId,
      exerciseName: latest.exerciseName,
      sessions: dates.length,
      firstTop,
      lastTop,
      bestTop,
      prCount,
      trend,
      anomaly,
      meta: { region: latest.region, muscles: latest.muscles },
    });
  }

  // ---- Group muscle → region → exercise -----------------------------------
  type RegionAcc = { region: string | null; exercises: ExerciseProgress[] };
  type MuscleAcc = {
    muscleSlug: string;
    muscleNameTr: string;
    regions: Map<string, RegionAcc>;
    sessions: number;
  };
  const muscles = new Map<string, MuscleAcc>();

  for (const ex of exercises) {
    for (const muscle of ex.meta.muscles) {
      let m = muscles.get(muscle.slug);
      if (!m) {
        m = {
          muscleSlug: muscle.slug,
          muscleNameTr: muscle.nameTr,
          regions: new Map(),
          sessions: 0,
        };
        muscles.set(muscle.slug, m);
      }
      m.sessions += ex.sessions;
      const regionKey = ex.meta.region ?? "";
      let r = m.regions.get(regionKey);
      if (!r) {
        r = { region: ex.meta.region, exercises: [] };
        m.regions.set(regionKey, r);
      }
      const { meta: _meta, ...plain } = ex;
      void _meta;
      r.exercises.push(plain);
    }
  }

  const muscleList: MuscleProgress[] = [...muscles.values()]
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        a.muscleNameTr.localeCompare(b.muscleNameTr, "tr"),
    )
    .map((m) => ({
      muscleSlug: m.muscleSlug,
      muscleNameTr: m.muscleNameTr,
      regions: [...m.regions.values()]
        .map((r) => ({
          region: r.region,
          exercises: [...r.exercises].sort((a, b) => b.sessions - a.sessions),
        }))
        .sort(
          (a, b) =>
            b.exercises.reduce((n, e) => n + e.sessions, 0) -
            a.exercises.reduce((n, e) => n + e.sessions, 0),
        ),
    }));

  return {
    sessionCount: windowDates.size,
    exercisesTotal: exercises.length,
    exercisesWithPR: exercises.filter((e) => e.prCount > 0).length,
    totalPRs: exercises.reduce((n, e) => n + e.prCount, 0),
    anomalyCount: exercises.filter((e) => e.anomaly).length,
    muscles: muscleList,
  };
}
