/**
 * Server-side loader for a coach's weekly, muscle-based report of one athlete.
 * Reads the athlete's sets for the given week (joined through the taxonomy) and
 * runs the pure buildCoachWeekly. Also computes a per-exercise plateau signal
 * from the athlete's recent session history (beyond the week) via detectPlateau.
 *
 * Coach read access is enforced by RLS (the athlete-detail page already reads
 * the same tables).
 */
import {
  buildCoachWeekly,
  type CoachWeeklyReport,
  type CoachWeekSet,
} from "@/lib/reports/coach-weekly";
import { detectPlateau, type PlateauSessionStat } from "@/lib/reports/plateau";
import type { TargetRef } from "@/lib/reports/session-report";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

type TargetRow = {
  role: "primary" | "secondary";
  muscle_functions: {
    slug: string;
    name_tr: string;
    muscles: { slug: string; name_tr: string } | null;
  } | null;
};

type SetRow = {
  session_id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  performed_at: string | null;
  created_at: string;
  exercise_id: string;
  exercise: { name: string; region: string | null; exercise_muscle_targets: TargetRow[] } | null;
};

export type CoachWeeklyResult = {
  report: CoachWeeklyReport;
  /** exerciseId -> stall flag for the coach "attention" note. */
  plateaus: Record<string, { stalled: boolean; sessions: number }>;
};

function toTargets(rows: TargetRow[]): TargetRef[] {
  const out: TargetRef[] = [];
  for (const t of rows) {
    const fn = t.muscle_functions;
    const muscle = fn?.muscles;
    if (!fn || !muscle) continue;
    out.push({
      muscleSlug: muscle.slug,
      muscleNameTr: muscle.name_tr,
      functionSlug: fn.slug,
      functionNameTr: fn.name_tr,
      role: t.role,
    });
  }
  return out;
}

const SET_SELECT =
  "session_id, weight, reps, rir, performed_at, created_at, exercise_id, exercise:exercises(name, region, exercise_muscle_targets(role, muscle_functions(slug, name_tr, muscles(slug, name_tr))))";

export async function loadCoachWeekly(
  supabase: Client,
  athleteId: string,
  weekStart: string,
  weekEnd: string,
): Promise<CoachWeeklyResult> {
  // Sessions in the selected week.
  const { data: weekSessions } = await supabase
    .from("log_sessions")
    .select("id, session_date")
    .eq("athlete_id", athleteId)
    .gte("session_date", weekStart)
    .lte("session_date", weekEnd);

  const sessionDate = new Map<string, string>();
  for (const s of weekSessions ?? []) sessionDate.set(s.id, s.session_date);
  const weekSessionIds = [...sessionDate.keys()];

  if (weekSessionIds.length === 0) {
    return { report: { totalSets: 0, muscles: [] }, plateaus: {} };
  }

  const { data: rawSets } = await supabase
    .from("log_sets")
    .select(SET_SELECT)
    .in("session_id", weekSessionIds);

  const setRows = (rawSets ?? []) as unknown as SetRow[];
  const sets: CoachWeekSet[] = setRows.map((r) => ({
    sessionId: r.session_id,
    sessionDate: sessionDate.get(r.session_id) ?? weekStart,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise?.name ?? "Egzersiz",
    weight: r.weight != null ? Number(r.weight) : null,
    reps: r.reps,
    rir: r.rir != null ? Number(r.rir) : null,
    region: r.exercise?.region ?? null,
    performedAt: r.performed_at,
    createdAt: r.created_at,
    targets: toTargets(r.exercise?.exercise_muscle_targets ?? []),
  }));

  const report = buildCoachWeekly(sets);

  // ---- Plateau: per-exercise stall over the athlete's recent sessions ----
  const weekExerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
  const plateaus = await loadPlateaus(supabase, athleteId, weekExerciseIds, weekEnd);

  return { report, plateaus };
}

async function loadPlateaus(
  supabase: Client,
  athleteId: string,
  exerciseIds: string[],
  weekEnd: string,
): Promise<Record<string, { stalled: boolean; sessions: number }>> {
  if (exerciseIds.length === 0) return {};

  // Recent sessions up to the end of the selected week (newest first).
  const { data: recentSessions } = await supabase
    .from("log_sessions")
    .select("id, session_date")
    .eq("athlete_id", athleteId)
    .lte("session_date", weekEnd)
    .order("session_date", { ascending: false })
    .limit(12);

  const dateById = new Map<string, string>();
  for (const s of recentSessions ?? []) dateById.set(s.id, s.session_date);
  const ids = [...dateById.keys()];
  if (ids.length === 0) return {};

  const { data: rawSets } = await supabase
    .from("log_sets")
    .select("session_id, exercise_id, weight, reps, rir")
    .in("session_id", ids)
    .in("exercise_id", exerciseIds);

  type PlateauRow = {
    session_id: string;
    exercise_id: string;
    weight: number | null;
    reps: number | null;
    rir: number | null;
  };

  // exerciseId -> (session_date -> aggregated stat)
  const byExercise = new Map<string, Map<string, PlateauSessionStat>>();
  for (const r of (rawSets ?? []) as PlateauRow[]) {
    const date = dateById.get(r.session_id);
    if (!date || r.weight == null || r.reps == null) continue;
    let perSession = byExercise.get(r.exercise_id);
    if (!perSession) {
      perSession = new Map();
      byExercise.set(r.exercise_id, perSession);
    }
    const existing = perSession.get(date);
    const w = Number(r.weight);
    const rir = r.rir != null ? Number(r.rir) : null;
    if (!existing) {
      perSession.set(date, { date, topWeight: w, topReps: r.reps, bestRir: rir });
    } else {
      existing.topWeight = Math.max(existing.topWeight, w);
      existing.topReps = Math.max(existing.topReps, r.reps);
      if (rir != null) existing.bestRir = existing.bestRir == null ? rir : Math.min(existing.bestRir, rir);
    }
  }

  const out: Record<string, { stalled: boolean; sessions: number }> = {};
  for (const [exerciseId, perSession] of byExercise) {
    out[exerciseId] = detectPlateau([...perSession.values()]);
  }
  return out;
}
