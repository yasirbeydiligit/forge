"use server";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlternativeSuggestion } from "@/components/programs/types";

/**
 * Automatic exercise alternatives via the Phase 1 SQL function
 * `suggest_exercise_alternatives` (same movement_pattern + ≥1 shared primary
 * muscle/function target). SECURITY INVOKER → RLS-aware, so the caller only ever
 * sees alternatives among exercises visible to them (system + their own). Shared
 * by the coach and athlete program builders; swapping to a suggestion keeps
 * muscle/function tracking continuous.
 */
export async function suggestAlternatives(
  exerciseId: string,
): Promise<AlternativeSuggestion[]> {
  if (!exerciseId) return [];
  await requireProfile();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("suggest_exercise_alternatives", {
    p_exercise: exerciseId,
  });
  if (error || !data) return [];

  return data.map((r) => ({
    exerciseId: r.exercise_id,
    name: r.name,
    movementPattern: r.movement_pattern,
    equipmentType: r.equipment_type,
    sharedPrimary: r.shared_primary,
    sharedSecondary: r.shared_secondary,
  }));
}
