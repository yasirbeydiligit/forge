"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const assignSchema = z.object({
  programId: z.string().uuid("Program seç."),
  workoutId: z.string().uuid("Antrenman seç."),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  athleteId: z.string().uuid().optional().or(z.literal("")),
});

export async function createCalendarAssignment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const coach = await requireCoach();
  const parsed = assignSchema.safeParse({
    programId: formData.get("programId"),
    workoutId: formData.get("workoutId"),
    scheduledDate: formData.get("scheduledDate"),
    athleteId: formData.get("athleteId") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("calendar_assignments").insert({
    program_id: parsed.data.programId,
    workout_id: parsed.data.workoutId,
    scheduled_date: parsed.data.scheduledDate,
    athlete_id: parsed.data.athleteId || null,
    created_by: coach.id,
  });
  if (error) return { error: "Atama eklenemedi." };

  revalidatePath("/panel/takvim");
  return { ok: true };
}

export async function deleteCalendarAssignment(
  formData: FormData,
): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("calendar_assignments").delete().eq("id", id);
  revalidatePath("/panel/takvim");
}
