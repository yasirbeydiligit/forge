"use server";

import { revalidatePath } from "next/cache";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function enrollProgram(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("enrollments")
    .upsert(
      { program_id: programId, athlete_id: profile.id, status: "active" },
      { onConflict: "program_id,athlete_id" },
    );

  revalidatePath("/programlar");
  revalidatePath("/bugun");
  revalidatePath("/takvim");
}

export async function unenrollProgram(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("enrollments")
    .delete()
    .eq("program_id", programId)
    .eq("athlete_id", profile.id);

  revalidatePath("/programlar");
  revalidatePath("/bugun");
  revalidatePath("/takvim");
}
