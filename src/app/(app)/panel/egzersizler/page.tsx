import type { Metadata } from "next";
import { Dumbbell, ExternalLink, Pencil, Trash2 } from "lucide-react";

import { deleteExercise } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { loadMuscleTaxonomy } from "@/lib/exercises/load-taxonomy";
import { createExercise, updateExercise } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EQUIPMENT_TYPE_LABELS_TR,
  MOVEMENT_PATTERN_LABELS_TR,
  type EquipmentType,
  type MovementPattern,
} from "@/lib/taxonomy";
import type { Exercise } from "@/lib/types";

export const metadata: Metadata = { title: "Egzersiz Kütüphanesi" };

type TargetRow = { exercise_id: string; muscle_function_id: string; role: string };

export default async function ExercisesPage() {
  const coach = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { muscles, functions } = await loadMuscleTaxonomy(supabase);

  // The coach library shows the shared system/community exercises plus the
  // coach's own — not every athlete's private exercise.
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .or(`is_system.eq.true,created_by.eq.${coach.id}`)
    .order("category", { ascending: true, nullsFirst: false })
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

  const grouped = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const key = ex.category ?? "Diğer";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ex);
  }

  const newTrigger = (
    <Button>
      <Pencil className="size-4" /> Yeni egzersiz
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Egzersiz Kütüphanesi"
        description="Programlarında kullanacağın egzersizleri buradan yönet."
      >
        <ExerciseForm
          create={createExercise}
          update={updateExercise}
          muscles={muscles}
          functions={functions}
        />
      </PageHeader>

      {exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz egzersiz yok"
          description="İlk egzersizini ekleyerek kütüphaneni oluşturmaya başla."
          action={
            <ExerciseForm
              create={createExercise}
              update={updateExercise}
              muscles={muscles}
              functions={functions}
              trigger={newTrigger}
            />
          }
        />
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([category, items]) => (
            <section key={category}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </h2>
                <Badge variant="secondary" className="rounded-full">
                  {items.length}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((ex) => {
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
                  return (
                    <PaperCard key={ex.id} className="flex flex-col gap-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-serif text-lg text-paper-foreground">
                            {ex.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {ex.category ? (
                              <span className="inline-block rounded-full border border-paper-border px-2 py-0.5 text-xs text-paper-muted">
                                {ex.category}
                              </span>
                            ) : null}
                            {!ex.is_system ? (
                              <span className="inline-block rounded-full border border-lab-green/40 bg-lab-green/10 px-2 py-0.5 text-xs text-lab-green">
                                Özel
                              </span>
                            ) : null}
                          </div>
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
                            description={`"${ex.name}" silinsin mi? Programlarda kullanılıyorsa silinemeyebilir.`}
                            triggerClassName="text-paper-muted hover:bg-paper-foreground/[0.06]"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </ConfirmButton>
                        </div>
                      </div>
                      {meta.length ? (
                        <p className="text-xs text-paper-muted">
                          {meta.join(" · ")}
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
