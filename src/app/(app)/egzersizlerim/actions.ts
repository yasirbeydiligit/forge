"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth";
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
  const profile = await requireProfile();
  // Athlete-authored exercises stay private (owner + coach read-only via RLS).
  const res = await createExerciseFromForm({
    userId: profile.id,
    isSystem: false,
    formData,
  });
  if (res.ok) revalidatePath("/egzersizlerim");
  return res;
}

export async function updateExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const res = await updateExerciseFromForm({ formData });
  if (res.ok) revalidatePath("/egzersizlerim");
  return res;
}

export async function deleteExercise(formData: FormData): Promise<void> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("exercises").delete().eq("id", id);
  revalidatePath("/egzersizlerim");
}
