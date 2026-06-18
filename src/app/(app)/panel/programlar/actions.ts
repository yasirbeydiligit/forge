"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().nonnegative().nullable(),
);
const optionalNum = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().nonnegative().nullable(),
);

/* -------------------------------- Programs -------------------------------- */

const programSchema = z.object({
  name: z.string().trim().min(2, "Program adı en az 2 karakter olmalı."),
  description: z.string().trim().optional().nullable(),
  coverUrl: z.string().trim().optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function createProgram(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();
  const parsed = programSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    coverUrl: formData.get("coverUrl") || null,
    isPublished: formData.get("isPublished") !== "false",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      cover_url: parsed.data.coverUrl || null,
      is_published: parsed.data.isPublished ?? true,
      created_by: coach.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Program oluşturulamadı." };

  revalidatePath("/panel/programlar");
  redirect(`/panel/programlar/${data.id}`);
}

export async function updateProgram(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Program bulunamadı." };
  const parsed = programSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    coverUrl: formData.get("coverUrl") || null,
    isPublished: formData.get("isPublished") !== "false",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("programs")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      cover_url: parsed.data.coverUrl || null,
      is_published: parsed.data.isPublished ?? true,
    })
    .eq("id", id);
  if (error) return { error: "Program güncellenemedi." };

  revalidatePath("/panel/programlar");
  revalidatePath(`/panel/programlar/${id}`);
  return { ok: true };
}

export async function deleteProgram(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("programs").delete().eq("id", id);
  revalidatePath("/panel/programlar");
  redirect("/panel/programlar");
}

/* -------------------------------- Workouts -------------------------------- */

const workoutSchema = z.object({
  programId: z.string().uuid(),
  name: z.string().trim().min(1, "Antrenman adı gerekli."),
  notes: z.string().trim().optional().nullable(),
});

export async function createWorkout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const parsed = workoutSchema.safeParse({
    programId: formData.get("programId"),
    name: formData.get("name"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("workouts")
    .select("id", { count: "exact", head: true })
    .eq("program_id", parsed.data.programId);

  const { error } = await supabase.from("workouts").insert({
    program_id: parsed.data.programId,
    name: parsed.data.name,
    notes: parsed.data.notes || null,
    order_index: count ?? 0,
  });
  if (error) return { error: "Antrenman eklenemedi." };

  revalidatePath(`/panel/programlar/${parsed.data.programId}`);
  return { ok: true };
}

export async function updateWorkout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  const parsed = workoutSchema.safeParse({
    programId: formData.get("programId"),
    name: formData.get("name"),
    notes: formData.get("notes") || null,
  });
  if (!id || !parsed.success) {
    return { error: parsed.success ? "Antrenman bulunamadı." : parsed.error.issues[0]?.message };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("workouts")
    .update({ name: parsed.data.name, notes: parsed.data.notes || null })
    .eq("id", id);
  if (error) return { error: "Antrenman güncellenemedi." };

  revalidatePath(`/panel/programlar/${parsed.data.programId}`);
  return { ok: true };
}

export async function deleteWorkout(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  const programId = String(formData.get("programId") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("workouts").delete().eq("id", id);
  if (programId) revalidatePath(`/panel/programlar/${programId}`);
}

/* --------------------------- Workout exercises ---------------------------- */

const workoutExerciseSchema = z.object({
  workoutId: z.string().uuid(),
  programId: z.string().uuid(),
  exerciseId: z.string().uuid("Bir egzersiz seç."),
  targetSets: optionalInt,
  targetRepsMin: optionalInt,
  targetRepsMax: optionalInt,
  targetWeight: optionalNum,
  targetRpe: optionalNum,
  restSeconds: optionalInt,
  notes: z.string().trim().optional().nullable(),
});

export async function addWorkoutExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const parsed = workoutExerciseSchema.safeParse({
    workoutId: formData.get("workoutId"),
    programId: formData.get("programId"),
    exerciseId: formData.get("exerciseId"),
    targetSets: formData.get("targetSets"),
    targetRepsMin: formData.get("targetRepsMin"),
    targetRepsMax: formData.get("targetRepsMax"),
    targetWeight: formData.get("targetWeight"),
    targetRpe: formData.get("targetRpe"),
    restSeconds: formData.get("restSeconds"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("workout_exercises")
    .select("id", { count: "exact", head: true })
    .eq("workout_id", d.workoutId);

  const { error } = await supabase.from("workout_exercises").insert({
    workout_id: d.workoutId,
    exercise_id: d.exerciseId,
    order_index: count ?? 0,
    target_sets: d.targetSets,
    target_reps_min: d.targetRepsMin,
    target_reps_max: d.targetRepsMax,
    target_weight: d.targetWeight,
    target_rpe: d.targetRpe,
    rest_seconds: d.restSeconds,
    notes: d.notes || null,
  });
  if (error) return { error: "Egzersiz eklenemedi." };

  revalidatePath(`/panel/programlar/${d.programId}`);
  return { ok: true };
}

export async function updateWorkoutExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  const parsed = workoutExerciseSchema.safeParse({
    workoutId: formData.get("workoutId"),
    programId: formData.get("programId"),
    exerciseId: formData.get("exerciseId"),
    targetSets: formData.get("targetSets"),
    targetRepsMin: formData.get("targetRepsMin"),
    targetRepsMax: formData.get("targetRepsMax"),
    targetWeight: formData.get("targetWeight"),
    targetRpe: formData.get("targetRpe"),
    restSeconds: formData.get("restSeconds"),
    notes: formData.get("notes") || null,
  });
  if (!id || !parsed.success) {
    return { error: parsed.success ? "Kayıt bulunamadı." : parsed.error.issues[0]?.message };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("workout_exercises")
    .update({
      exercise_id: d.exerciseId,
      target_sets: d.targetSets,
      target_reps_min: d.targetRepsMin,
      target_reps_max: d.targetRepsMax,
      target_weight: d.targetWeight,
      target_rpe: d.targetRpe,
      rest_seconds: d.restSeconds,
      notes: d.notes || null,
    })
    .eq("id", id);
  if (error) return { error: "Egzersiz güncellenemedi." };

  revalidatePath(`/panel/programlar/${d.programId}`);
  return { ok: true };
}

export async function deleteWorkoutExercise(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  const programId = String(formData.get("programId") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("workout_exercises").delete().eq("id", id);
  if (programId) revalidatePath(`/panel/programlar/${programId}`);
}

/** Swap order with the adjacent exercise (direction: "up" | "down"). */
export async function moveWorkoutExercise(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  const workoutId = String(formData.get("workoutId") ?? "");
  const programId = String(formData.get("programId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !workoutId) return;

  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("workout_exercises")
    .select("id, order_index")
    .eq("workout_id", workoutId)
    .order("order_index", { ascending: true });
  if (!rows) return;

  const idx = rows.findIndex((r) => r.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= rows.length) return;

  const a = rows[idx];
  const b = rows[swapWith];
  await supabase
    .from("workout_exercises")
    .update({ order_index: b.order_index })
    .eq("id", a.id);
  await supabase
    .from("workout_exercises")
    .update({ order_index: a.order_index })
    .eq("id", b.id);

  if (programId) revalidatePath(`/panel/programlar/${programId}`);
}
