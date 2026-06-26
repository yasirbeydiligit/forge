"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth";
import {
  createExerciseFromForm,
  updateExerciseFromForm,
  type ExerciseFormState,
} from "@/lib/exercises/save-exercise";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = ExerciseFormState;

export async function createExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();
  // Coach-authored exercises join the shared system/community library.
  const res = await createExerciseFromForm({
    userId: coach.id,
    isSystem: true,
    formData,
  });
  if (res.ok) revalidatePath("/panel/egzersizler");
  return res;
}

export async function updateExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const res = await updateExerciseFromForm({ formData });
  if (res.ok) revalidatePath("/panel/egzersizler");
  return res;
}

export async function deleteExercise(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("exercises").delete().eq("id", id);
  revalidatePath("/panel/egzersizler");
}
