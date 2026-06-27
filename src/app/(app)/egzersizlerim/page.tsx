import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { createExercise, deleteExercise, updateExercise } from "./actions";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import {
  ExerciseLibrary,
  type ExerciseWithTargets,
} from "@/components/exercises/exercise-library";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { loadMuscleTaxonomy } from "@/lib/exercises/load-taxonomy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/types";

export const metadata: Metadata = { title: "Egzersizlerim" };

type TargetRow = { exercise_id: string; muscle_function_id: string; role: string };

export default async function MyExercisesPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { muscles, functions } = await loadMuscleTaxonomy(supabase);

  const { data } = await supabase
    .from("exercises")
    .select("*")
    .eq("created_by", profile.id)
    .eq("is_system", false)
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

  const addTrigger = (
    <Button>
      <Plus className="size-4" /> Yeni egzersiz
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Egzersizlerim"
        description="Kendi egzersizlerini tanımla; programlarında sistem egzersizleriyle birlikte kullan."
      >
        <ExerciseForm
          create={createExercise}
          update={updateExercise}
          muscles={muscles}
          functions={functions}
          trigger={addTrigger}
        />
      </PageHeader>

      <ExerciseLibrary
        exercises={exercisesWithTargets}
        muscles={muscles}
        functions={functions}
        create={createExercise}
        update={updateExercise}
        remove={deleteExercise}
        emptyTitle="Henüz kendi egzersizin yok"
        emptyDescription="Sistemde olmayan bir hareketi ekle — hedef kasları seçersen raporlar ve muadil önerisi de çalışır."
      />
    </div>
  );
}
