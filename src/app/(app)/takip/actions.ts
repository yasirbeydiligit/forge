"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { parseGoals, resolveEnabled } from "@/lib/metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

// Coerce to a number (or null) and clamp into [0, max] so out-of-range input
// is stored at the boundary rather than silently dropped.
const num = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number()
      .nullable()
      .transform((n) =>
        n == null || Number.isNaN(n) ? null : Math.min(Math.max(n, 0), max),
      ),
  );

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: num(300),
  sleepHours: num(24),
  restingHr: num(250),
  energy: num(10),
  hunger: num(10),
  adherence: num(10),
  digestion: num(10),
  steps: num(100000),
  notes: z.string().trim().max(140).optional().nullable(),
});

export async function saveDailyMetric(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const parsed = schema.safeParse({
    date: formData.get("date"),
    weight: formData.get("weight"),
    sleepHours: formData.get("sleepHours"),
    restingHr: formData.get("restingHr"),
    energy: formData.get("energy"),
    hunger: formData.get("hunger"),
    adherence: formData.get("adherence"),
    digestion: formData.get("digestion"),
    steps: formData.get("steps"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return;
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  await supabase.from("daily_metrics").upsert(
    {
      athlete_id: profile.id,
      metric_date: d.date,
      weight: d.weight,
      sleep_hours: d.sleepHours,
      resting_hr: d.restingHr == null ? null : Math.round(d.restingHr),
      energy: d.energy == null ? null : Math.round(d.energy),
      hunger: d.hunger == null ? null : Math.round(d.hunger),
      adherence: d.adherence == null ? null : Math.round(d.adherence),
      digestion: d.digestion == null ? null : Math.round(d.digestion),
      steps: d.steps == null ? null : Math.round(d.steps),
      notes: d.notes || null,
    },
    { onConflict: "athlete_id,metric_date" },
  );

  revalidatePath("/takip");
}

/**
 * Persist the athlete's tracker preferences: which metric columns are shown and
 * any goals used as the colouring center. Values are validated against the
 * registry (`resolveEnabled` / `parseGoals`) so a malformed payload can't store
 * unknown keys or out-of-range goals.
 */
export async function saveTrackerSettings(input: {
  enabled: string[];
  goals: Record<string, number | null>;
}): Promise<void> {
  const profile = await requireProfile();

  const enabled = resolveEnabled(input.enabled);
  // Drop nulls (cleared goals) before validating the rest against the registry.
  const goalEntries = Object.entries(input.goals ?? {}).filter(
    ([, v]) => v != null,
  );
  const goals = parseGoals(Object.fromEntries(goalEntries));

  const supabase = await createSupabaseServerClient();
  await supabase.from("tracker_settings").upsert(
    {
      athlete_id: profile.id,
      enabled,
      goals,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id" },
  );

  revalidatePath("/takip");
}

/* -------------------------------------------------------------------------- */
/*  Cardio entries                                                            */
/* -------------------------------------------------------------------------- */

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

const cardioSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  activity: z.enum(["walk", "run", "swim", "bike", "elliptical", "other"], {
    message: "Bir aktivite seç.",
  }),
  durationMin: z.coerce
    .number()
    .int("Süre dakika cinsinden tam sayı olmalı.")
    .min(1, "Süre en az 1 dakika olmalı.")
    .max(1440, "Süre 24 saati aşamaz."),
  distanceKm: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .min(0, "Mesafe negatif olamaz.")
      .max(500, "Mesafe 500 km'yi aşamaz.")
      .nullable(),
  ),
  calories: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .int()
      .min(0)
      .max(10000, "Kalori 10.000'i aşamaz.")
      .nullable(),
  ),
  note: z.string().trim().max(140).optional().nullable(),
});

export async function saveCardio(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = cardioSchema.safeParse({
    date: formData.get("date"),
    activity: formData.get("activity"),
    durationMin: formData.get("durationMin"),
    distanceKm: formData.get("distanceKm"),
    calories: formData.get("calories"),
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cardio_sessions").insert({
    athlete_id: profile.id,
    session_date: d.date,
    activity: d.activity,
    duration_min: d.durationMin,
    distance_km: d.distanceKm,
    calories: d.calories,
    note: d.note || null,
    source: "manual",
  });
  if (error) return { error: "Kardiyo kaydedilemedi." };

  revalidatePath("/takip");
  return { ok: true };
}

export async function deleteCardio(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createSupabaseServerClient();
  // RLS also enforces ownership; the eq is a belt-and-braces filter.
  await supabase
    .from("cardio_sessions")
    .delete()
    .eq("id", id.data)
    .eq("athlete_id", profile.id);

  revalidatePath("/takip");
}
