"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const int = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number()
      .nullable()
      .transform((n) =>
        n == null || Number.isNaN(n)
          ? null
          : Math.round(Math.min(Math.max(n, 0), max)),
      ),
  );

function revalidate() {
  revalidatePath("/beslenme");
  revalidatePath("/beslenme/hazir-ogunler");
  revalidatePath("/bugun");
}

/* -------------------------------- Targets --------------------------------- */

const targetsSchema = z.object({
  kcal: int(15000),
  protein: int(1000),
  carbs: int(2000),
  fat: int(1000),
  waterMl: int(20000),
});

export async function saveTargets(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = targetsSchema.safeParse({
    kcal: formData.get("kcal"),
    protein: formData.get("protein"),
    carbs: formData.get("carbs"),
    fat: formData.get("fat"),
    waterMl: formData.get("waterMl"),
  });
  if (!parsed.success) return { error: "Form geçersiz." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("nutrition_targets").upsert(
    {
      athlete_id: profile.id,
      kcal: parsed.data.kcal,
      protein: parsed.data.protein,
      carbs: parsed.data.carbs,
      fat: parsed.data.fat,
      water_ml: parsed.data.waterMl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id" },
  );
  if (error) return { error: "Hedefler kaydedilemedi." };

  revalidate();
  return { ok: true };
}

/* -------------------------------- Water ----------------------------------- */

const waterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delta: z.coerce.number().int().min(-5000).max(5000),
});

/**
 * Add (or remove) water for a day. Reads the current value and writes the
 * clamped total back onto the day's `daily_metrics` row, leaving every other
 * wellness column untouched (upsert only sends water_ml).
 */
export async function adjustWater(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const parsed = waterSchema.safeParse({
    date: formData.get("date"),
    delta: formData.get("delta"),
  });
  if (!parsed.success) return;
  const { date, delta } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("daily_metrics")
    .select("water_ml")
    .eq("athlete_id", profile.id)
    .eq("metric_date", date)
    .maybeSingle();

  const current = existing?.water_ml ?? 0;
  const next = Math.max(0, Math.min(current + delta, 20000));

  await supabase.from("daily_metrics").upsert(
    { athlete_id: profile.id, metric_date: date, water_ml: next },
    { onConflict: "athlete_id,metric_date" },
  );

  revalidate();
}

/* --------------------------------- Meals ---------------------------------- */

const mealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1, "Öğün adı gerekli."),
  eatenAt: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(280).optional().nullable(),
  kcal: int(15000),
  protein: int(1000),
  carbs: int(2000),
  fat: int(1000),
});

export async function addMeal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = mealSchema.safeParse({
    date: formData.get("date"),
    name: formData.get("name"),
    eatenAt: formData.get("eatenAt") || "",
    description: formData.get("description") || null,
    kcal: formData.get("kcal"),
    protein: formData.get("protein"),
    carbs: formData.get("carbs"),
    fat: formData.get("fat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("meals").insert({
    athlete_id: profile.id,
    meal_date: d.date,
    eaten_at: d.eatenAt || null,
    name: d.name,
    description: d.description || null,
    kcal: d.kcal,
    protein: d.protein,
    carbs: d.carbs,
    fat: d.fat,
  });
  if (error) return { error: "Öğün eklenemedi." };

  // Optionally remember this meal in the athlete's saved-meal library.
  if (formData.get("saveAsTemplate") === "on") {
    await supabase.from("meal_templates").insert({
      athlete_id: profile.id,
      name: d.name,
      description: d.description || null,
      kcal: d.kcal,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
    });
  }

  revalidate();
  return { ok: true };
}

export async function deleteMeal(formData: FormData): Promise<void> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("meals").delete().eq("id", id);
  revalidate();
}

/* ----------------------------- Meal templates ----------------------------- */

const mealTemplateSchema = z.object({
  name: z.string().trim().min(1, "Öğün adı gerekli."),
  description: z.string().trim().max(280).optional().nullable(),
  kcal: int(15000),
  protein: int(1000),
  carbs: int(2000),
  fat: int(1000),
});

export async function updateMealTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Kayıt bulunamadı." };

  const parsed = mealTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    kcal: formData.get("kcal"),
    protein: formData.get("protein"),
    carbs: formData.get("carbs"),
    fat: formData.get("fat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  // RLS limits the update to the owner's own row.
  const { error } = await supabase
    .from("meal_templates")
    .update({
      name: d.name,
      description: d.description || null,
      kcal: d.kcal,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
    })
    .eq("id", id);
  if (error) return { error: "Hazır öğün güncellenemedi." };

  revalidate();
  return { ok: true };
}

export async function deleteMealTemplate(formData: FormData): Promise<void> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("meal_templates").delete().eq("id", id);
  revalidate();
}

/* ------------------------------- Protocols -------------------------------- */

const toggleSchema = z.object({
  protocolId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.enum(["0", "1"]),
});

/**
 * Mark (or clear) an assigned protocol as completed on a given day. Presence of
 * a protocol_completions row == done. RLS guarantees the athlete can only write
 * their own completions for a protocol currently assigned to them.
 */
export async function toggleProtocol(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const parsed = toggleSchema.safeParse({
    protocolId: formData.get("protocolId"),
    date: formData.get("date"),
    done: formData.get("done"),
  });
  if (!parsed.success) return;
  const { protocolId, date, done } = parsed.data;

  const supabase = await createSupabaseServerClient();
  if (done === "1") {
    await supabase.from("protocol_completions").upsert(
      {
        protocol_id: protocolId,
        athlete_id: profile.id,
        completion_date: date,
      },
      { onConflict: "protocol_id,athlete_id,completion_date" },
    );
  } else {
    await supabase
      .from("protocol_completions")
      .delete()
      .eq("protocol_id", protocolId)
      .eq("athlete_id", profile.id)
      .eq("completion_date", date);
  }

  revalidate();
}
