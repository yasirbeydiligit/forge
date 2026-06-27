"use client";

import { useMemo, useState } from "react";
import { Dumbbell, ExternalLink, Pencil, Trash2 } from "lucide-react";

import { ExerciseFilters } from "./exercise-filters";
import { ExerciseForm } from "./exercise-form";
import type { PickerFunction, PickerMuscle } from "./muscle-target-picker";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExerciseTargetInput } from "@/lib/exercise-targets";
import {
  exerciseCategories,
  exerciseRegions,
  filterExercises,
  groupExercisesByCategory,
} from "@/lib/exercises/filter";
import {
  EQUIPMENT_TYPE_LABELS_TR,
  MOVEMENT_PATTERN_LABELS_TR,
  type EquipmentType,
  type MovementPattern,
} from "@/lib/taxonomy";
import type { Exercise } from "@/lib/types";

export type ExerciseWithTargets = Exercise & {
  targets: ExerciseTargetInput[];
};

type Action = (
  prev: { ok?: boolean; error?: string },
  formData: FormData,
) => Promise<{ ok?: boolean; error?: string }>;
type VoidAction = (formData: FormData) => Promise<void>;

/**
 * Filterable exercise library grid (category + sub-region + name search),
 * grouped by muscle group, with per-card category/region/Özel badges and
 * edit/delete. Shared by the coach library; the create button lives in the page
 * header. Filtering happens client-side over the already-loaded list.
 */
export function ExerciseLibrary({
  exercises,
  muscles,
  functions,
  create,
  update,
  remove,
  emptyTitle = "Henüz egzersiz yok",
  emptyDescription = "İlk egzersizini ekleyerek kütüphaneni oluşturmaya başla.",
}: {
  exercises: ExerciseWithTargets[];
  muscles: PickerMuscle[];
  functions: PickerFunction[];
  create: Action;
  update: Action;
  remove: VoidAction;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => exerciseCategories(exercises), [exercises]);
  const regions = useMemo(
    () => exerciseRegions(exercises, category || undefined),
    [exercises, category],
  );
  const groups = useMemo(
    () =>
      groupExercisesByCategory(
        filterExercises(exercises, { category, region, query }),
      ),
    [exercises, category, region, query],
  );

  if (exercises.length === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title={emptyTitle}
        description={emptyDescription}
        action={
          <ExerciseForm
            create={create}
            update={update}
            muscles={muscles}
            functions={functions}
          />
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <ExerciseFilters
        categories={categories}
        regions={regions}
        category={category}
        region={region}
        query={query}
        onCategory={(v) => {
          setCategory(v);
          setRegion("");
        }}
        onRegion={setRegion}
        onQuery={setQuery}
      />

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Filtreyle eşleşen egzersiz yok.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.category}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.category}
                </h2>
                <Badge variant="secondary" className="rounded-full">
                  {group.items.length}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((ex) => {
                  const meta = [
                    ex.movement_pattern
                      ? MOVEMENT_PATTERN_LABELS_TR[
                          ex.movement_pattern as MovementPattern
                        ]
                      : null,
                    ex.equipment_type
                      ? EQUIPMENT_TYPE_LABELS_TR[
                          ex.equipment_type as EquipmentType
                        ]
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
                            {ex.region ? (
                              <span className="inline-block rounded-full border border-lab-blue/40 bg-lab-blue/10 px-2 py-0.5 text-xs text-lab-blue">
                                {ex.region}
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
                            create={create}
                            update={update}
                            muscles={muscles}
                            functions={functions}
                            exercise={ex}
                            initialTargets={ex.targets}
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
                            action={remove}
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
                      {ex.targets.length > 0 ? (
                        <p className="text-xs text-paper-muted">
                          {ex.targets.length} hedef kas
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
