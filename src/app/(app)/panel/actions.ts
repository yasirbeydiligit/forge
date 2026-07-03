"use server";

import { revalidatePath } from "next/cache";

import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function revalidateTriage(athleteId: string) {
  revalidatePath("/panel");
  revalidatePath(`/panel/sporcular/${athleteId}`);
}

/**
 * Mark a derived triage alert as seen. Alerts are recomputed on every load;
 * this only records the (athlete, key, fingerprint) period so the exact same
 * alert stops surfacing. New data ⇒ new fingerprint ⇒ the alert returns.
 */
export async function dismissAlert(formData: FormData): Promise<void> {
  const coach = await requireCoach();
  const athleteId = String(formData.get("athleteId") ?? "");
  const alertKey = String(formData.get("alertKey") ?? "");
  const fingerprint = String(formData.get("fingerprint") ?? "");
  if (!athleteId || !alertKey || !fingerprint) return;

  const supabase = await createSupabaseServerClient();
  // Unique constraint dedupes double-submits; ignore that error silently.
  await supabase.from("alert_dismissals").insert({
    athlete_id: athleteId,
    alert_key: alertKey,
    fingerprint,
    dismissed_by: coach.id,
  });
  revalidateTriage(athleteId);
}

/** Undo a dismissal (row delete — there is deliberately no UPDATE path). */
export async function undismissAlert(formData: FormData): Promise<void> {
  await requireCoach();
  const athleteId = String(formData.get("athleteId") ?? "");
  const alertKey = String(formData.get("alertKey") ?? "");
  const fingerprint = String(formData.get("fingerprint") ?? "");
  if (!athleteId || !alertKey || !fingerprint) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("alert_dismissals")
    .delete()
    .eq("athlete_id", athleteId)
    .eq("alert_key", alertKey)
    .eq("fingerprint", fingerprint);
  revalidateTriage(athleteId);
}
