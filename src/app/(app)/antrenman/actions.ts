"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureSession } from "./session-helpers";

const optionalNum = (v: FormDataEntryValue | null) =>
  v === "" || v == null ? null : Number(v);

const logSetSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assignmentId: z.string().uuid().optional().or(z.literal("")),
  workoutId: z.string().uuid().optional().or(z.literal("")),
  exerciseId: z.string().uuid(),
  workoutExerciseId: z.string().uuid().optional().or(z.literal("")),
});

export async function logSet(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const parsed = logSetSchema.safeParse({
    date: formData.get("date"),
    assignmentId: formData.get("assignmentId") || "",
    workoutId: formData.get("workoutId") || "",
    exerciseId: formData.get("exerciseId"),
    workoutExerciseId: formData.get("workoutExerciseId") || "",
  });
  if (!parsed.success) return;

  const weight = optionalNum(formData.get("weight"));
  const reps = optionalNum(formData.get("reps"));
  const rpe = optionalNum(formData.get("rpe"));
  if (weight == null && reps == null) return; // nothing to log

  const supabase = await createSupabaseServerClient();
  const sessionId = await ensureSession(supabase, {
    athleteId: profile.id,
    assignmentId: parsed.data.assignmentId || null,
    workoutId: parsed.data.workoutId || null,
    date: parsed.data.date,
  });
  if (!sessionId) return;

  const { count } = await supabase
    .from("log_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("exercise_id", parsed.data.exerciseId);

  await supabase.from("log_sets").insert({
    session_id: sessionId,
    exercise_id: parsed.data.exerciseId,
    workout_exercise_id: parsed.data.workoutExerciseId || null,
    set_number: (count ?? 0) + 1,
    weight,
    reps: reps == null ? null : Math.round(reps),
    rpe,
  });

  revalidatePath(`/antrenman/${parsed.data.date}`);
}

export async function deleteLogSet(formData: FormData): Promise<void> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("log_sets").delete().eq("id", id);
  if (date) revalidatePath(`/antrenman/${date}`);
}

export async function toggleSessionComplete(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const date = String(formData.get("date") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  const completed = formData.get("completed") === "true";

  const supabase = await createSupabaseServerClient();
  const sessionId = await ensureSession(supabase, {
    athleteId: profile.id,
    assignmentId: assignmentId || null,
    workoutId: workoutId || null,
    date,
  });
  if (!sessionId) return;

  await supabase
    .from("log_sessions")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", sessionId);

  if (date) revalidatePath(`/antrenman/${date}`);
}

export async function saveSessionNotes(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const date = String(formData.get("date") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const sessionId = await ensureSession(supabase, {
    athleteId: profile.id,
    assignmentId: assignmentId || null,
    workoutId: workoutId || null,
    date,
  });
  if (!sessionId) return;

  await supabase
    .from("log_sessions")
    .update({ notes: notes || null })
    .eq("id", sessionId);

  if (date) revalidatePath(`/antrenman/${date}`);
}
