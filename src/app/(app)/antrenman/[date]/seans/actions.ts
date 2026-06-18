"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureSession } from "../../session-helpers";

/**
 * JSON server actions for the live session player. These return values (unlike
 * the FormData actions) so the optimistic client can reconcile server ids and
 * recover after offline queueing. They reuse `ensureSession`, so a set logged
 * before the session was explicitly started still lands in the right session.
 * Schema/RLS unchanged.
 */

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const uuidOrNull = z.string().uuid().nullable();

const sessionRef = z.object({
  date: z.string().regex(dateRe),
  assignmentId: uuidOrNull,
  workoutId: uuidOrNull,
});

const logSetInput = sessionRef.extend({
  exerciseId: z.string().uuid(),
  workoutExerciseId: uuidOrNull,
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  rpe: z.number().nullable(),
  note: z.string().nullable(),
});

const finishInput = sessionRef.extend({
  completed: z.boolean(),
  notes: z.string().nullable(),
});

export async function startSessionAction(
  raw: z.input<typeof sessionRef>,
): Promise<{ sessionId: string } | { error: string }> {
  const profile = await requireProfile();
  const parsed = sessionRef.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createSupabaseServerClient();
  const sessionId = await ensureSession(supabase, {
    athleteId: profile.id,
    assignmentId: parsed.data.assignmentId,
    workoutId: parsed.data.workoutId,
    date: parsed.data.date,
  });
  if (!sessionId) return { error: "could_not_start" };

  revalidatePath(`/antrenman/${parsed.data.date}`);
  return { sessionId };
}

export async function logSetAction(
  raw: z.input<typeof logSetInput>,
): Promise<{ id: string } | { error: string }> {
  const profile = await requireProfile();
  const parsed = logSetInput.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  if (d.weight == null && d.reps == null) return { error: "empty" };

  const supabase = await createSupabaseServerClient();
  const sessionId = await ensureSession(supabase, {
    athleteId: profile.id,
    assignmentId: d.assignmentId,
    workoutId: d.workoutId,
    date: d.date,
  });
  if (!sessionId) return { error: "no_session" };

  // Authoritative set number from the server (sets sync in FIFO order, so this
  // stays consistent with the client's optimistic numbering).
  const { count } = await supabase
    .from("log_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("exercise_id", d.exerciseId);

  const { data, error } = await supabase
    .from("log_sets")
    .insert({
      session_id: sessionId,
      exercise_id: d.exerciseId,
      workout_exercise_id: d.workoutExerciseId,
      set_number: (count ?? 0) + 1,
      weight: d.weight,
      reps: d.reps == null ? null : Math.round(d.reps),
      rpe: d.rpe,
      notes: d.note,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "insert_failed" };

  revalidatePath(`/antrenman/${d.date}`);
  return { id: data.id };
}

export async function deleteSetAction(
  raw: { id: string; date: string },
): Promise<{ ok: true } | { error: string }> {
  await requireProfile();
  const id = z.string().uuid().safeParse(raw.id);
  if (!id.success) return { error: "invalid" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("log_sets").delete().eq("id", id.data);
  if (error) return { error: "delete_failed" };

  if (dateRe.test(raw.date)) revalidatePath(`/antrenman/${raw.date}`);
  return { ok: true };
}

export async function finishSessionAction(
  raw: z.input<typeof finishInput>,
): Promise<{ ok: true } | { error: string }> {
  const profile = await requireProfile();
  const parsed = finishInput.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const sessionId = await ensureSession(supabase, {
    athleteId: profile.id,
    assignmentId: d.assignmentId,
    workoutId: d.workoutId,
    date: d.date,
  });
  if (!sessionId) return { error: "no_session" };

  const { error } = await supabase
    .from("log_sessions")
    .update({
      completed: d.completed,
      completed_at: d.completed ? new Date().toISOString() : null,
      notes: d.notes && d.notes.trim() ? d.notes.trim() : null,
    })
    .eq("id", sessionId);

  if (error) return { error: "update_failed" };

  revalidatePath(`/antrenman/${d.date}`);
  return { ok: true };
}
