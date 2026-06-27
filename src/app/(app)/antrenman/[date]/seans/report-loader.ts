/**
 * Server-side loader for the authoritative post-session report. Reads the saved
 * sets for a session (joined through the taxonomy to muscles/functions) plus
 * each exercise's prior history, and runs the pure buildSessionReport. The DB is
 * the source of truth here, so the report is consistent with what the coach sees
 * (the live in-player badges are only optimistic).
 */
import { prFrontier, type PRSet } from "@/lib/pr/evaluate-pr";
import {
  buildSessionReport,
  type ReportSet,
  type SessionReport,
  type TargetRef,
} from "@/lib/reports/session-report";
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
  weight: number | null;
  reps: number | null;
  rir: number | null;
  notes: string | null;
  performed_at: string | null;
  created_at: string;
  exercise_id: string;
  exercise: {
    name: string;
    category: string | null;
    region: string | null;
    exercise_muscle_targets: TargetRow[];
  } | null;
};

type HistoryRow = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  exercise_id: string;
  session: { session_date: string } | null;
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
  "weight, reps, rir, notes, performed_at, created_at, exercise_id, exercise:exercises(name, category, region, exercise_muscle_targets(role, muscle_functions(slug, name_tr, muscles(slug, name_tr))))";

/**
 * Build the report for one session. History is filtered to `athleteId` (not just
 * RLS) so a coach reading several athletes never contaminates one athlete's PR /
 * delta history.
 */
async function reportForSession(
  supabase: Client,
  sessionId: string,
  athleteId: string,
  cutoffDate: string,
): Promise<SessionReport | null> {
  const { data: rawSets } = await supabase.from("log_sets").select(SET_SELECT).eq("session_id", sessionId);

  const setRows = (rawSets ?? []) as unknown as SetRow[];
  if (setRows.length === 0) return null;

  const sets: ReportSet[] = setRows.map((r) => ({
    exerciseId: r.exercise_id,
    exerciseName: r.exercise?.name ?? "Egzersiz",
    weight: r.weight != null ? Number(r.weight) : null,
    reps: r.reps,
    rir: r.rir != null ? Number(r.rir) : null,
    region: r.exercise?.region ?? null,
    category: r.exercise?.category ?? null,
    note: r.notes && r.notes.trim() ? r.notes.trim() : null,
    performedAt: r.performed_at,
    createdAt: r.created_at,
    targets: toTargets(r.exercise?.exercise_muscle_targets ?? []),
  }));

  // Prior history per exercise for this athlete (strictly before cutoffDate).
  const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
  const { data: rawHistory } = exerciseIds.length
    ? await supabase
        .from("log_sets")
        .select("weight, reps, rir, exercise_id, session:log_sessions!inner(session_date, athlete_id)")
        .eq("session.athlete_id", athleteId)
        .in("exercise_id", exerciseIds)
    : { data: [] };

  const historyRows = ((rawHistory ?? []) as unknown as HistoryRow[]).filter(
    (r) => r.session && r.session.session_date < cutoffDate,
  );

  const histories: Record<string, { prHistory: PRSet[]; prevSessionSets: PRSet[] }> = {};
  for (const id of exerciseIds) {
    const rows = historyRows.filter((r) => r.exercise_id === id);
    const asPR = (r: HistoryRow): PRSet => ({
      weight: r.weight != null ? Number(r.weight) : null,
      reps: r.reps,
      rir: r.rir != null ? Number(r.rir) : null,
    });
    const prHistory = prFrontier(rows.map(asPR));
    // Previous session = sets from the most recent prior session_date.
    const prevDate = rows
      .map((r) => r.session!.session_date)
      .sort((a, b) => b.localeCompare(a))[0];
    const prevSessionSets = prevDate
      ? rows.filter((r) => r.session!.session_date === prevDate).map(asPR)
      : [];
    histories[id] = { prHistory, prevSessionSets };
  }

  return buildSessionReport({ sets, histories });
}

/** Athlete's own report, keyed by the calendar assignment (live finish summary). */
export async function loadSessionReport(
  supabase: Client,
  athleteId: string,
  date: string,
  assignmentId: string,
): Promise<SessionReport | null> {
  const { data: sessionRow } = await supabase
    .from("log_sessions")
    .select("id")
    .eq("athlete_id", athleteId)
    .eq("assignment_id", assignmentId)
    .maybeSingle();
  if (!sessionRow) return null;
  return reportForSession(supabase, sessionRow.id, athleteId, date);
}

export type SessionReportMeta = {
  workoutName: string;
  sessionDate: string;
  completed: boolean;
  notes: string | null;
  durationMs: number | null;
};

/** Any session by id (coach view of an athlete's session). RLS gates access. */
export async function loadSessionReportById(
  supabase: Client,
  sessionId: string,
): Promise<{ report: SessionReport | null; meta: SessionReportMeta } | null> {
  const { data: s } = await supabase
    .from("log_sessions")
    .select(
      "id, athlete_id, session_date, completed, notes, created_at, completed_at, workout:workouts(name)",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!s) return null;

  const session = s as unknown as {
    id: string;
    athlete_id: string;
    session_date: string;
    completed: boolean;
    notes: string | null;
    created_at: string;
    completed_at: string | null;
    workout: { name: string } | null;
  };

  const report = await reportForSession(supabase, session.id, session.athlete_id, session.session_date);
  const durationMs =
    session.completed_at && session.created_at
      ? new Date(session.completed_at).getTime() - new Date(session.created_at).getTime()
      : null;

  return {
    report,
    meta: {
      workoutName: session.workout?.name ?? "Seans",
      sessionDate: session.session_date,
      completed: session.completed,
      notes: session.notes,
      durationMs,
    },
  };
}
