/**
 * Post-session report aggregator (pure). Turns a session's logged sets plus
 * per-exercise history into the muscle/function set distribution, the movement
 * summary with up/flat/down deltas, PR + RIR-PR counts, and an approximate
 * per-muscle time distribution. Volume is SET COUNT throughout (never tonnage).
 *
 * Equivalents collapse automatically because counting is keyed by muscle and
 * muscle_function, not by exercise.
 */
import { evaluatePR, type PRSet, type PRType } from "@/lib/pr/evaluate-pr";

export type TargetRef = {
  muscleSlug: string;
  muscleNameTr: string;
  functionSlug: string;
  functionNameTr: string;
  role: "primary" | "secondary";
};

export type ReportSet = {
  exerciseId: string;
  exerciseName: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  performedAt: string | null;
  createdAt: string;
  targets: TargetRef[];
};

export type ExerciseHistory = {
  /** PR frontier of sets before this session. */
  prHistory: PRSet[];
  /** The previous session's sets, for the up/flat/down delta. */
  prevSessionSets: PRSet[];
};

export type Direction = "up" | "flat" | "down";

export type FunctionVolume = {
  functionSlug: string;
  functionNameTr: string;
  primarySets: number;
  secondarySets: number;
};

export type MuscleVolume = {
  muscleSlug: string;
  muscleNameTr: string;
  primarySets: number;
  secondarySets: number;
  functions: FunctionVolume[];
  /** Approximate active time attributed to this muscle's primary work (ms). */
  activeMs: number;
};

export type ExerciseDelta = {
  exerciseId: string;
  exerciseName: string;
  weight: Direction | null;
  reps: Direction | null;
  prCount: number;
  rirPrCount: number;
  sets: { weight: number | null; reps: number | null; prType: PRType | null }[];
};

export type SessionReport = {
  totalSets: number;
  muscles: MuscleVolume[];
  exercises: ExerciseDelta[];
  prCount: number;
  rirPrCount: number;
};

function timeOf(s: ReportSet): number {
  return new Date(s.performedAt ?? s.createdAt).getTime();
}

function direction(now: number, prev: number): Direction {
  if (now > prev) return "up";
  if (now < prev) return "down";
  return "flat";
}

/** Heaviest set (tie-break most reps) among a list, ignoring null weights. */
function topSet(sets: { weight: number | null; reps: number | null }[]) {
  let best: { weight: number; reps: number | null } | null = null;
  for (const s of sets) {
    if (s.weight == null) continue;
    if (
      !best ||
      s.weight > best.weight ||
      (s.weight === best.weight && (s.reps ?? 0) > (best.reps ?? 0))
    ) {
      best = { weight: s.weight, reps: s.reps };
    }
  }
  return best;
}

type MuscleAcc = {
  muscleSlug: string;
  muscleNameTr: string;
  primarySets: number;
  secondarySets: number;
  functions: Map<string, FunctionVolume>;
  activeMs: number;
};

type ExAcc = {
  exerciseId: string;
  exerciseName: string;
  order: number;
  prCount: number;
  rirPrCount: number;
  sets: { weight: number | null; reps: number | null; prType: PRType | null }[];
};

export function buildSessionReport(input: {
  sets: ReportSet[];
  histories: Record<string, ExerciseHistory>;
}): SessionReport {
  const { sets, histories } = input;
  const ordered = [...sets].sort((a, b) => timeOf(a) - timeOf(b));

  const muscles = new Map<string, MuscleAcc>();
  const running = new Map<string, PRSet[]>(); // exerciseId -> history so far
  const exercises = new Map<string, ExAcc>();

  let prevTime: number | null = null;
  let prCount = 0;
  let rirPrCount = 0;

  ordered.forEach((s, i) => {
    const time = timeOf(s);
    const block = prevTime == null ? 0 : Math.max(0, time - prevTime);
    prevTime = time;

    // PR evaluation against prior history plus earlier in-session sets.
    const hist = running.get(s.exerciseId) ?? [...(histories[s.exerciseId]?.prHistory ?? [])];
    const result = evaluatePR({ weight: s.weight, reps: s.reps, rir: s.rir }, hist);
    running.set(s.exerciseId, [...hist, { weight: s.weight, reps: s.reps, rir: s.rir }]);
    const prType: PRType | null = result.isPR ? result.type : null;
    if (prType && prType !== "rir") prCount += 1;
    if (prType === "rir") rirPrCount += 1;

    // Muscle / function distribution + time attribution to primary muscles.
    // Functions are counted per target; a muscle is counted ONCE per set (even
    // when the exercise hits it via two functions) so muscle-level set counts
    // reflect actual sets, not target rows.
    const primaryMuscleSlugs = new Set<string>();
    const secondaryMuscleSlugs = new Set<string>();
    for (const t of s.targets) {
      let m = muscles.get(t.muscleSlug);
      if (!m) {
        m = {
          muscleSlug: t.muscleSlug,
          muscleNameTr: t.muscleNameTr,
          primarySets: 0,
          secondarySets: 0,
          functions: new Map(),
          activeMs: 0,
        };
        muscles.set(t.muscleSlug, m);
      }
      let f = m.functions.get(t.functionSlug);
      if (!f) {
        f = {
          functionSlug: t.functionSlug,
          functionNameTr: t.functionNameTr,
          primarySets: 0,
          secondarySets: 0,
        };
        m.functions.set(t.functionSlug, f);
      }
      if (t.role === "primary") {
        f.primarySets += 1;
        primaryMuscleSlugs.add(t.muscleSlug);
      } else {
        f.secondarySets += 1;
        secondaryMuscleSlugs.add(t.muscleSlug);
      }
    }
    // Roll up to the muscle once per set (primary wins over secondary).
    for (const slug of primaryMuscleSlugs) {
      const m = muscles.get(slug)!;
      m.primarySets += 1;
      m.activeMs += block;
    }
    for (const slug of secondaryMuscleSlugs) {
      if (primaryMuscleSlugs.has(slug)) continue;
      muscles.get(slug)!.secondarySets += 1;
    }

    // Exercise grouping (first appearance order).
    let ex = exercises.get(s.exerciseId);
    if (!ex) {
      ex = {
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        order: i,
        prCount: 0,
        rirPrCount: 0,
        sets: [],
      };
      exercises.set(s.exerciseId, ex);
    }
    ex.sets.push({ weight: s.weight, reps: s.reps, prType });
    if (prType && prType !== "rir") ex.prCount += 1;
    if (prType === "rir") ex.rirPrCount += 1;
  });

  const muscleList: MuscleVolume[] = [...muscles.values()]
    .map((m) => ({
      muscleSlug: m.muscleSlug,
      muscleNameTr: m.muscleNameTr,
      primarySets: m.primarySets,
      secondarySets: m.secondarySets,
      activeMs: m.activeMs,
      functions: [...m.functions.values()].sort(
        (a, b) => b.primarySets - a.primarySets || b.secondarySets - a.secondarySets,
      ),
    }))
    .sort(
      (a, b) =>
        b.primarySets - a.primarySets ||
        b.secondarySets - a.secondarySets ||
        a.muscleNameTr.localeCompare(b.muscleNameTr, "tr"),
    );

  const exerciseList: ExerciseDelta[] = [...exercises.values()]
    .sort((a, b) => a.order - b.order)
    .map((ex) => {
      const prev = histories[ex.exerciseId]?.prevSessionSets ?? [];
      const now = topSet(ex.sets);
      const before = topSet(prev);
      const weight = now && before ? direction(now.weight, before.weight) : null;
      const reps =
        now && before && now.reps != null && before.reps != null
          ? direction(now.reps, before.reps)
          : null;
      return {
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        weight,
        reps,
        prCount: ex.prCount,
        rirPrCount: ex.rirPrCount,
        sets: ex.sets,
      };
    });

  return {
    totalSets: sets.length,
    muscles: muscleList,
    exercises: exerciseList,
    prCount,
    rirPrCount,
  };
}
