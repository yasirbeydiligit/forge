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

  const { data: rawSets } = await supabase
    .from("log_sets")
    .select(
      "weight, reps, rir, notes, performed_at, created_at, exercise_id, exercise:exercises(name, category, region, exercise_muscle_targets(role, muscle_functions(slug, name_tr, muscles(slug, name_tr))))",
    )
    .eq("session_id", sessionRow.id);

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

  // Prior history per exercise (strictly before this session's date).
  const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
  const { data: rawHistory } = exerciseIds.length
    ? await supabase
        .from("log_sets")
        .select("weight, reps, rir, exercise_id, session:log_sessions(session_date)")
        .in("exercise_id", exerciseIds)
    : { data: [] };

  const historyRows = ((rawHistory ?? []) as unknown as HistoryRow[]).filter(
    (r) => r.session && r.session.session_date < date,
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
