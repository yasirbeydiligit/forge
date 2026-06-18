"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const exerciseSchema = z.object({
  name: z.string().trim().min(2, "Egzersiz adı en az 2 karakter olmalı."),
  category: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  videoUrl: z
    .string()
    .trim()
    .url("Geçerli bir bağlantı girin.")
    .optional()
    .or(z.literal("")),
});

function parseExercise(formData: FormData) {
  return exerciseSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || null,
    description: formData.get("description") || null,
    videoUrl: formData.get("videoUrl") || "",
  });
}

export async function createExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();
  const parsed = parseExercise(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("exercises").insert({
    name: parsed.data.name,
    category: parsed.data.category || null,
    description: parsed.data.description || null,
    video_url: parsed.data.videoUrl || null,
    created_by: coach.id,
  });
  if (error) return { error: "Egzersiz kaydedilemedi." };

  revalidatePath("/panel/egzersizler");
  return { ok: true };
}

export async function updateExercise(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Egzersiz bulunamadı." };

  const parsed = parseExercise(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("exercises")
    .update({
      name: parsed.data.name,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      video_url: parsed.data.videoUrl || null,
    })
    .eq("id", id);
  if (error) return { error: "Egzersiz güncellenemedi." };

  revalidatePath("/panel/egzersizler");
  return { ok: true };
}

export async function deleteExercise(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("exercises").delete().eq("id", id);
  revalidatePath("/panel/egzersizler");
}
