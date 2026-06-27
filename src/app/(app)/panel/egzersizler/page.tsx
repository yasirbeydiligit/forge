import type { Metadata } from "next";

import { createExercise, deleteExercise, updateExercise } from "./actions";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import {
  ExerciseLibrary,
  type ExerciseWithTargets,
} from "@/components/exercises/exercise-library";
import { PageHeader } from "@/components/shell/page-header";
import { requireCoach } from "@/lib/auth";
import { loadMuscleTaxonomy } from "@/lib/exercises/load-taxonomy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/types";

export const metadata: Metadata = { title: "Egzersiz Kütüphanesi" };

type TargetRow = { exercise_id: string; muscle_function_id: string; role: string };

export default async function ExercisesPage() {
  const coach = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { muscles, functions } = await loadMuscleTaxonomy(supabase);

  // System/community exercises plus the coach's own — not athletes' private ones.
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .or(`is_system.eq.true,created_by.eq.${coach.id}`)
    .order("category", { ascending: true, nullsFirst: false })
    .order("region", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  const exercises = (data ?? []) as Exercise[];

  const { data: targetData } = await supabase
    .from("exercise_muscle_targets")
    .select("exercise_id, muscle_function_id, role")
    .in(
      "exercise_id",
      exercises.map((e) => e.id),
    );
  const targetsByExercise = new Map<string, ExerciseWithTargets["targets"]>();
  for (const t of (targetData ?? []) as TargetRow[]) {
    const list = targetsByExercise.get(t.exercise_id) ?? [];
    list.push({
      muscleFunctionId: t.muscle_function_id,
      role: t.role as "primary" | "secondary",
    });
    targetsByExercise.set(t.exercise_id, list);
  }
  const exercisesWithTargets: ExerciseWithTargets[] = exercises.map((e) => ({
    ...e,
    targets: targetsByExercise.get(e.id) ?? [],
  }));

  return (
    <div>
      <PageHeader
        title="Egzersiz Kütüphanesi"
        description="Programlarında kullanacağın egzersizleri buradan yönet. Kategori ve bölgeye göre süzebilirsin."
      >
        <ExerciseForm
          create={createExercise}
          update={updateExercise}
          muscles={muscles}
          functions={functions}
        />
      </PageHeader>

      <ExerciseLibrary
        exercises={exercisesWithTargets}
        muscles={muscles}
        functions={functions}
        create={createExercise}
        update={updateExercise}
        remove={deleteExercise}
      />
    </div>
  );
}
