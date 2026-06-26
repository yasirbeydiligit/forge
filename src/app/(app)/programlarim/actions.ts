"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import * as core from "@/lib/programs/core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = core.FormState;

const BASE = "/programlarim";
const programPath = (formData: FormData) =>
  `${BASE}/${String(formData.get("programId") ?? "")}`;

/* -------------------------------- Programs -------------------------------- */

export async function createProgram(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  // Personal programs are always private (RLS forbids athletes from publishing).
  const res = await core.insertProgram({
    userId: profile.id,
    isPublished: false,
    formData,
  });
  if (res.error || !res.id) {
    return { error: res.error ?? "Program oluşturulamadı." };
  }
  revalidatePath(BASE);
  redirect(`${BASE}/${res.id}`);
}

export async function updateProgram(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const res = await core.applyProgramUpdate({ formData });
  if (res.ok) {
    revalidatePath(BASE);
    revalidatePath(`${BASE}/${String(formData.get("id") ?? "")}`);
  }
  return res;
}

export async function deleteProgram(formData: FormData): Promise<void> {
  await requireProfile();
  await core.removeProgram(formData);
  revalidatePath(BASE);
  redirect(BASE);
}

/* -------------------------------- Workouts -------------------------------- */

export async function createWorkout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const res = await core.insertWorkout(formData);
  if (res.ok) revalidatePath(programPath(formData));
  return res;
}

export async function updateWorkout(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const res = await core.applyWorkoutUpdate(formData);
  if (res.ok) revalidatePath(programPath(formData));
  return res;
}

export async function deleteWorkout(formData: FormData): Promise<void> {
  await requireProfile();
  await core.removeWorkout(formData);
  revalidatePath(programPath(formData));
}

/* --------------------------- Workout exercises ---------------------------- */

export async function addWorkoutExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const res = await core.insertWorkoutExercise(formData);
  if (res.ok) revalidatePath(programPath(formData));
  return res;
}

export async function updateWorkoutExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const res = await core.applyWorkoutExerciseUpdate(formData);
  if (res.ok) revalidatePath(programPath(formData));
  return res;
}

export async function deleteWorkoutExercise(formData: FormData): Promise<void> {
  await requireProfile();
  await core.removeWorkoutExercise(formData);
  revalidatePath(programPath(formData));
}

export async function moveWorkoutExercise(formData: FormData): Promise<void> {
  await requireProfile();
  await core.swapWorkoutExercise(formData);
  revalidatePath(programPath(formData));
}

/* ----------------------------- Calendar assign ---------------------------- */

const assignSchema = z.object({
  programId: z.string().uuid("Program seç."),
  workoutId: z.string().uuid("Antrenman seç."),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
});

export async function assignToCalendar(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = assignSchema.safeParse({
    programId: formData.get("programId"),
    workoutId: formData.get("workoutId"),
    scheduledDate: formData.get("scheduledDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("calendar_assignments").insert({
    program_id: parsed.data.programId,
    workout_id: parsed.data.workoutId,
    scheduled_date: parsed.data.scheduledDate,
    athlete_id: profile.id,
    created_by: profile.id,
  });
  if (error) return { error: "Takvime eklenemedi." };

  revalidatePath(`${BASE}/${parsed.data.programId}`);
  revalidatePath("/takvim");
  revalidatePath("/bugun");
  return { ok: true };
}
