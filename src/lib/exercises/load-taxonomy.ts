import "server-only";

import type {
  PickerFunction,
  PickerMuscle,
} from "@/components/exercises/muscle-target-picker";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MuscleRegion } from "@/lib/taxonomy";

/**
 * Load muscles + their functions in the shape the MuscleTargetPicker expects.
 * Reference data (RLS: all authenticated read), so coach and athlete pages share
 * this single loader.
 */
export async function loadMuscleTaxonomy(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<{ muscles: PickerMuscle[]; functions: PickerFunction[] }> {
  const [{ data: muscles }, { data: functions }] = await Promise.all([
    supabase
      .from("muscles")
      .select("id, name_tr, region")
      .order("region", { ascending: true })
      .order("name_tr", { ascending: true }),
    supabase
      .from("muscle_functions")
      .select("id, muscle_id, name_tr")
      .order("name_tr", { ascending: true }),
  ]);

  return {
    muscles: (muscles ?? []).map((m) => ({
      id: m.id,
      nameTr: m.name_tr,
      region: m.region as MuscleRegion,
    })),
    functions: (functions ?? []).map((f) => ({
      id: f.id,
      muscleId: f.muscle_id,
      nameTr: f.name_tr,
    })),
  };
}
