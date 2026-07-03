/**
 * Server loader for the coach's training-progress report. Pulls the athlete's
 * set history (window + enough trailing history so evaluatePR never calls an
 * old achievement a new PR) in ONE query and runs the pure builder.
 */
import { format, subDays } from "date-fns";

import {
  buildTrainingProgress,
  type ProgressSet,
  type TrainingProgressReport,
} from "@/lib/reports/training-progress";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/** Default report window in weeks (coach can pick 1/4/8/12 or any value). */
export const DEFAULT_PROGRESS_WEEKS = 12;
export const MAX_PROGRESS_WEEKS = 52;
/** Extra trailing history feeding PR evaluation only. */
const HISTORY_DAYS = 365;

type Row = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  exercise_id: string;
  exercise: {
    name: string;
    region: string | null;
    exercise_muscle_targets: {
      role: "primary" | "secondary";
      muscle_functions: {
        muscles: { slug: string; name_tr: string } | null;
      } | null;
    }[];
  } | null;
  session: { athlete_id: string; session_date: string } | null;
};

export type TrainingProgressResult = {
  report: TrainingProgressReport;
  windowStart: string;
};

export async function loadTrainingProgress(
  supabase: Client,
  athleteId: string,
  windowWeeks: number = DEFAULT_PROGRESS_WEEKS,
): Promise<TrainingProgressResult> {
  const now = new Date();
  const windowStart = format(subDays(now, windowWeeks * 7), "yyyy-MM-dd");
  const historyStart = format(
    subDays(now, Math.max(HISTORY_DAYS, windowWeeks * 7)),
    "yyyy-MM-dd",
  );

  const { data } = await supabase
    .from("log_sets")
    .select(
      "weight, reps, rir, exercise_id, exercise:exercises(name, region, exercise_muscle_targets(role, muscle_functions(muscles(slug, name_tr)))), session:log_sessions!inner(athlete_id, session_date)",
    )
    .eq("log_sessions.athlete_id", athleteId)
    .gte("log_sessions.session_date", historyStart);

  const sets: ProgressSet[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const muscles: { slug: string; nameTr: string }[] = [];
    const seen = new Set<string>();
    for (const t of r.exercise?.exercise_muscle_targets ?? []) {
      if (t.role !== "primary") continue;
      const muscle = t.muscle_functions?.muscles;
      if (!muscle || seen.has(muscle.slug)) continue;
      seen.add(muscle.slug);
      muscles.push({ slug: muscle.slug, nameTr: muscle.name_tr });
    }
    return {
      date: r.session?.session_date ?? historyStart,
      exerciseId: r.exercise_id,
      exerciseName: r.exercise?.name ?? "Egzersiz",
      region: r.exercise?.region ?? null,
      muscles,
      weight: r.weight != null ? Number(r.weight) : null,
      reps: r.reps,
      rir: r.rir != null ? Number(r.rir) : null,
    };
  });

  return { report: buildTrainingProgress(sets, windowStart), windowStart };
}
