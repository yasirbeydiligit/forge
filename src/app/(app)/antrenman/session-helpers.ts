/**
 * Shared logbook helpers used by both the spreadsheet-style FormData actions
 * (`./[date]/../actions.ts`) and the JSON session-player actions
 * (`./[date]/seans/actions.ts`). Plain module (not "use server") so it can be
 * imported into "use server" files without each export becoming an action.
 */
import type { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Find or create the athlete's log session for a given assignment + date.
 * Idempotent: a session is keyed by (athlete, assignment) when an assignment
 * exists, otherwise by (athlete, date) for a free/unplanned session.
 */
export async function ensureSession(
  supabase: SupabaseServer,
  args: {
    athleteId: string;
    assignmentId: string | null;
    workoutId: string | null;
    date: string;
  },
): Promise<string | null> {
  const { athleteId, assignmentId, workoutId, date } = args;

  if (assignmentId) {
    const { data: existing } = await supabase
      .from("log_sessions")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("assignment_id", assignmentId)
      .maybeSingle();
    if (existing) return existing.id;
  } else {
    const { data: existing } = await supabase
      .from("log_sessions")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("session_date", date)
      .is("assignment_id", null)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const { data: created } = await supabase
    .from("log_sessions")
    .insert({
      athlete_id: athleteId,
      assignment_id: assignmentId,
      workout_id: workoutId,
      session_date: date,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}
