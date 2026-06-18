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
