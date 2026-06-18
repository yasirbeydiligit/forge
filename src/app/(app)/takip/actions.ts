"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      notes: d.notes || null,
    },
    { onConflict: "athlete_id,metric_date" },
  );

  revalidatePath("/takip");
}
