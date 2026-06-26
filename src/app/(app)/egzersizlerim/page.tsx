import type { Metadata } from "next";
import { Dumbbell, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";

import { createExercise, deleteExercise, updateExercise } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { loadMuscleTaxonomy } from "@/lib/exercises/load-taxonomy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EQUIPMENT_TYPE_LABELS_TR,
  MOVEMENT_PATTERN_LABELS_TR,
  type EquipmentType,
  type MovementPattern,
} from "@/lib/taxonomy";
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
    .order("name", { ascending: true });
  const exercises = (data ?? []) as Exercise[];

  const { data: targetData } = await supabase
    .from("exercise_muscle_targets")
    .select("exercise_id, muscle_function_id, role")
    .in(
      "exercise_id",
      exercises.map((e) => e.id),
    );
  const targetsByExercise = new Map<
    string,
    { muscleFunctionId: string; role: "primary" | "secondary" }[]
  >();
  for (const t of (targetData ?? []) as TargetRow[]) {
    const list = targetsByExercise.get(t.exercise_id) ?? [];
    list.push({
      muscleFunctionId: t.muscle_function_id,
      role: t.role as "primary" | "secondary",
    });
    targetsByExercise.set(t.exercise_id, list);
  }

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

      {exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz kendi egzersizin yok"
          description="Sistemde olmayan bir hareketi ekle — hedef kasları seçersen raporlar ve muadil önerisi de çalışır."
          action={
            <ExerciseForm
              create={createExercise}
              update={updateExercise}
              muscles={muscles}
              functions={functions}
              trigger={addTrigger}
            />
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((ex) => {
            const meta = [
              ex.movement_pattern
                ? MOVEMENT_PATTERN_LABELS_TR[
                    ex.movement_pattern as MovementPattern
                  ]
                : null,
              ex.equipment_type
                ? EQUIPMENT_TYPE_LABELS_TR[ex.equipment_type as EquipmentType]
                : null,
            ].filter(Boolean);
            const targetCount = targetsByExercise.get(ex.id)?.length ?? 0;
            return (
              <PaperCard key={ex.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg text-paper-foreground">
                      {ex.name}
                    </p>
                    <span className="mt-1 inline-block rounded-full border border-lab-green/40 bg-lab-green/10 px-2 py-0.5 text-xs text-lab-green">
                      Özel
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center text-paper-foreground">
                    <ExerciseForm
                      create={createExercise}
                      update={updateExercise}
                      muscles={muscles}
                      functions={functions}
                      exercise={ex}
                      initialTargets={targetsByExercise.get(ex.id) ?? []}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-paper-muted hover:bg-paper-foreground/[0.06] hover:text-paper-foreground"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <ConfirmButton
                      action={deleteExercise}
                      fields={{ id: ex.id }}
                      title="Egzersizi sil"
                      description={`"${ex.name}" silinsin mi? Bir programda kullanılıyorsa silinemeyebilir.`}
                      triggerClassName="text-paper-muted hover:bg-paper-foreground/[0.06]"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </ConfirmButton>
                  </div>
                </div>
                {meta.length ? (
                  <p className="text-xs text-paper-muted">{meta.join(" · ")}</p>
                ) : null}
                {targetCount > 0 ? (
                  <p className="text-xs text-paper-muted">
                    {targetCount} hedef kas
                  </p>
                ) : null}
                {ex.description ? (
                  <p className="line-clamp-2 text-sm text-paper-muted">
                    {ex.description}
                  </p>
                ) : null}
                {ex.video_url ? (
                  <a
                    href={ex.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-lab-green hover:underline"
                  >
                    <ExternalLink className="size-3" /> Video
                  </a>
                ) : null}
              </PaperCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
