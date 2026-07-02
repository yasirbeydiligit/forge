"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { normalizeUsername } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

const identitySchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı."),
  username: z.string().optional().nullable(),
  bio: z.string().trim().max(280).optional().nullable(),
  avatarUrl: z.string().trim().optional().nullable(),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = identitySchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    bio: formData.get("bio") || null,
    avatarUrl: formData.get("avatarUrl") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const username = normalizeUsername(parsed.data.username);
  if (username === undefined) {
    return {
      error:
        "Kullanıcı adı 3–20 karakter olmalı; yalnız küçük harf, rakam ve alt çizgi.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      username,
      bio: parsed.data.bio || null,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", profile.id);
  if (error) {
    if (error.code === "23505") return { error: "Bu kullanıcı adı alınmış." };
    return { error: "Profil güncellenemedi." };
  }

  revalidatePath("/profil");
  return { ok: true };
}

const detailsSchema = z.object({
  heightCm: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .int("Boy tam sayı olmalı.")
      .min(100, "Boy 100–250 cm aralığında olmalı.")
      .max(250, "Boy 100–250 cm aralığında olmalı.")
      .nullable(),
  ),
  birthDate: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Doğum tarihi geçersiz.")
      .nullable(),
  ),
  sex: z.preprocess(emptyToNull, z.enum(["male", "female"]).nullable()),
  unit: z.enum(["kg", "lb"]).default("kg"),
  goal: z.preprocess(
    emptyToNull,
    z.enum(["muscle_gain", "strength", "fat_loss", "maintenance"]).nullable(),
  ),
  weeklyTargetDays: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .int()
      .min(1, "Haftalık gün 1–7 aralığında olmalı.")
      .max(7, "Haftalık gün 1–7 aralığında olmalı.")
      .nullable(),
  ),
});

export async function updateDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = detailsSchema.safeParse({
    heightCm: formData.get("heightCm"),
    birthDate: formData.get("birthDate"),
    sex: formData.get("sex"),
    unit: formData.get("unit") ?? "kg",
    goal: formData.get("goal"),
    weeklyTargetDays: formData.get("weeklyTargetDays"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profile_details").upsert(
    {
      user_id: profile.id,
      height_cm: d.heightCm,
      birth_date: d.birthDate,
      sex: d.sex,
      unit: d.unit,
      goal: d.goal,
      weekly_target_days: d.weeklyTargetDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "Bilgiler kaydedilemedi." };

  // The goal feeds tracker colouring and Bugün's weekly target display.
  revalidatePath("/profil");
  revalidatePath("/takip");
  revalidatePath("/bugun");
  return { ok: true };
}
