import "server-only";

import { z } from "zod";

import { parseExerciseTargets } from "@/lib/exercise-targets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EQUIPMENT_TYPES,
  MOVEMENT_PATTERNS,
  type EquipmentType,
  type MovementPattern,
} from "@/lib/taxonomy";

/**
 * Shared core for creating/updating a user- or coach-defined exercise plus its
 * muscle/function targets. The thin "use server" actions in
 * /panel/egzersizler (coach, is_system=true) and /egzersizlerim (athlete,
 * is_system=false) call these and then revalidate their own paths. RLS is the
 * authoritative gate; `isSystem` only sets the row flag on create.
 */
export type ExerciseFormState = { ok?: boolean; error?: string };

const patternSet = new Set<string>(MOVEMENT_PATTERNS);
const equipmentSet = new Set<string>(EQUIPMENT_TYPES);

const schema = z.object({
  name: z.string().trim().min(2, "Egzersiz adı en az 2 karakter olmalı."),
  category: z.string().trim().optional(),
  region: z.string().trim().optional(),
  movementPattern: z
    .string()
    .trim()
    .refine((v) => v === "" || patternSet.has(v), "Geçersiz hareket paterni."),
  equipmentType: z
    .string()
    .trim()
    .refine((v) => v === "" || equipmentSet.has(v), "Geçersiz ekipman."),
  description: z.string().trim().optional(),
  videoUrl: z
    .string()
    .trim()
    .url("Geçerli bir bağlantı girin.")
    .optional()
    .or(z.literal("")),
});

function parseForm(formData: FormData) {
  return schema.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    region: formData.get("region") ?? "",
    movementPattern: formData.get("movementPattern") ?? "",
    equipmentType: formData.get("equipmentType") ?? "",
    description: formData.get("description") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
  });
}

type Fields = z.infer<typeof schema>;

function rowFromFields(f: Fields) {
  return {
    name: f.name,
    category: f.category || null,
    region: f.region || null,
    movement_pattern: (f.movementPattern || null) as MovementPattern | null,
    equipment_type: (f.equipmentType || null) as EquipmentType | null,
    description: f.description || null,
    video_url: f.videoUrl || null,
  };
}

async function writeTargets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  exerciseId: string,
  formData: FormData,
): Promise<boolean> {
  const targets = parseExerciseTargets(formData.get("targets"));
  await supabase
    .from("exercise_muscle_targets")
    .delete()
    .eq("exercise_id", exerciseId);
  if (targets.length === 0) return true;
  const { error } = await supabase.from("exercise_muscle_targets").insert(
    targets.map((t) => ({
      exercise_id: exerciseId,
      muscle_function_id: t.muscleFunctionId,
      role: t.role,
    })),
  );
  return !error;
}

export async function createExerciseFromForm(opts: {
  userId: string;
  isSystem: boolean;
  formData: FormData;
}): Promise<ExerciseFormState> {
  const parsed = parseForm(opts.formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      ...rowFromFields(parsed.data),
      is_system: opts.isSystem,
      created_by: opts.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Egzersiz kaydedilemedi." };

  if (!(await writeTargets(supabase, data.id, opts.formData))) {
    return { error: "Hedef kaslar kaydedilemedi." };
  }
  return { ok: true };
}

export async function updateExerciseFromForm(opts: {
  formData: FormData;
}): Promise<ExerciseFormState> {
  const id = String(opts.formData.get("id") ?? "");
  if (!id) return { error: "Egzersiz bulunamadı." };

  const parsed = parseForm(opts.formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("exercises")
    .update(rowFromFields(parsed.data))
    .eq("id", id);
  if (error) return { error: "Egzersiz güncellenemedi." };

  if (!(await writeTargets(supabase, id, opts.formData))) {
    return { error: "Hedef kaslar kaydedilemedi." };
  }
  return { ok: true };
}

/** Load a user/coach exercise's targets for the edit form. */
export async function loadExerciseTargets(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  exerciseId: string,
) {
  const { data } = await supabase
    .from("exercise_muscle_targets")
    .select("muscle_function_id, role")
    .eq("exercise_id", exerciseId);
  return (data ?? []).map((t) => ({
    muscleFunctionId: t.muscle_function_id,
    role: t.role as "primary" | "secondary",
  }));
}
