import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";

import { ProgramDialog } from "./program-dialog";
import type { ProgramDetailActions } from "./types";
import { WorkoutDialog } from "./workout-dialog";
import { WorkoutExerciseDialog } from "./workout-exercise-dialog";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber, formatRepRange, formatRest } from "@/lib/format";
import type { Exercise, Program, WorkoutWithExercises } from "@/lib/types";

/**
 * Shared program-detail builder (workout days + ordered exercises). Coach and
 * athlete pages render this with their own role-scoped action bundle, paths and
 * header extras. Behaviour is identical to the original coach view.
 */
export function ProgramDetail({
  program,
  workouts,
  exercises,
  actions,
  basePath,
  exerciseLibraryHref,
  backLabel = "Programlar",
  showPublish = false,
  showDraftBadge = false,
  headerActions,
}: {
  program: Program;
  workouts: WorkoutWithExercises[];
  exercises: Exercise[];
  actions: ProgramDetailActions;
  basePath: string;
  exerciseLibraryHref: string;
  backLabel?: string;
  showPublish?: boolean;
  showDraftBadge?: boolean;
  headerActions?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Link
        href={basePath}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="hidden size-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-secondary sm:block">
            {program.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={program.cover_url}
                alt={program.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Dumbbell className="size-7 text-primary/40" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
              {showDraftBadge && !program.is_published ? (
                <Badge variant="secondary">Taslak</Badge>
              ) : null}
            </div>
            {program.description ? (
              <p className="max-w-prose text-sm text-muted-foreground">
                {program.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {headerActions}
          <ProgramDialog
            update={actions.updateProgram}
            program={program}
            showPublish={showPublish}
            trigger={
              <Button variant="outline">
                <Pencil className="size-4" /> Düzenle
              </Button>
            }
          />
          <ConfirmButton
            action={actions.deleteProgram}
            fields={{ id: program.id }}
            title="Programı sil"
            description="Bu program, tüm antrenmanları ve takvim atamaları silinecek. Emin misin?"
            triggerVariant="outline"
            triggerSize="icon"
          >
            <Trash2 className="size-4 text-destructive" />
          </ConfirmButton>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Antrenman günleri</h2>
        <WorkoutDialog
          create={actions.createWorkout}
          update={actions.updateWorkout}
          programId={program.id}
        />
      </div>

      {workouts.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz antrenman günü yok"
          description="Bir antrenman günü ekle (örn. Gün A), sonra içine egzersizleri sırala."
          action={
            <WorkoutDialog
              create={actions.createWorkout}
              update={actions.updateWorkout}
              programId={program.id}
            />
          }
        />
      ) : (
        <div className="space-y-5">
          {workouts.map((workout) => {
            const items = workout.workout_exercises ?? [];
            return (
              <Card key={workout.id} className="gap-0 p-0">
                <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                  <div>
                    <p className="font-semibold">{workout.name}</p>
                    {workout.notes ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {workout.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <WorkoutDialog
                      create={actions.createWorkout}
                      update={actions.updateWorkout}
                      programId={program.id}
                      workout={workout}
                      trigger={
                        <Button variant="ghost" size="icon">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <ConfirmButton
                      action={actions.deleteWorkout}
                      fields={{ id: workout.id, programId: program.id }}
                      title="Antrenmanı sil"
                      description={`"${workout.name}" ve içindeki egzersizler silinsin mi?`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </ConfirmButton>
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {items.map((item, index) => {
                    const reps = formatRepRange(
                      item.target_reps_min,
                      item.target_reps_max,
                    );
                    const rest = formatRest(item.rest_seconds);
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 p-3 sm:px-4"
                      >
                        <span className="hidden text-muted-foreground sm:block">
                          <GripVertical className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            <span className="text-muted-foreground">
                              {index + 1}.
                            </span>{" "}
                            {item.exercise?.name ?? "Egzersiz"}
                            {item.exercise && !item.exercise.is_system ? (
                              <span className="ml-1.5 rounded-full border border-lab-green/40 bg-lab-green/10 px-1.5 py-0.5 text-[10px] font-medium text-lab-green">
                                Özel
                              </span>
                            ) : null}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {item.target_sets ? (
                              <span>
                                {item.target_sets} set
                                {reps ? ` × ${reps} tekrar` : ""}
                              </span>
                            ) : reps ? (
                              <span>{reps} tekrar</span>
                            ) : null}
                            {item.target_weight ? (
                              <span>{formatNumber(item.target_weight, " kg")}</span>
                            ) : null}
                            {item.target_rir ? (
                              <span>RIR {formatNumber(item.target_rir)}</span>
                            ) : null}
                            {rest ? <span>{rest} dinlenme</span> : null}
                          </div>
                          {item.notes ? (
                            <p className="mt-0.5 text-xs italic text-muted-foreground">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center">
                          <form action={actions.moveWorkoutExercise}>
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="hidden"
                              name="workoutId"
                              value={workout.id}
                            />
                            <input
                              type="hidden"
                              name="programId"
                              value={program.id}
                            />
                            <input type="hidden" name="direction" value="up" />
                            <Button
                              variant="ghost"
                              size="icon"
                              type="submit"
                              disabled={index === 0}
                              aria-label="Yukarı taşı"
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                          </form>
                          <form action={actions.moveWorkoutExercise}>
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="hidden"
                              name="workoutId"
                              value={workout.id}
                            />
                            <input
                              type="hidden"
                              name="programId"
                              value={program.id}
                            />
                            <input type="hidden" name="direction" value="down" />
                            <Button
                              variant="ghost"
                              size="icon"
                              type="submit"
                              disabled={index === items.length - 1}
                              aria-label="Aşağı taşı"
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                          </form>
                          <WorkoutExerciseDialog
                            programId={program.id}
                            workoutId={workout.id}
                            exercises={exercises}
                            add={actions.addWorkoutExercise}
                            update={actions.updateWorkoutExercise}
                            suggest={actions.suggestAlternatives}
                            workoutExercise={item}
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <ConfirmButton
                            action={actions.deleteWorkoutExercise}
                            fields={{ id: item.id, programId: program.id }}
                            title="Egzersizi kaldır"
                            description="Bu egzersiz antrenmandan kaldırılsın mı?"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </ConfirmButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-border p-3 sm:px-4">
                  {exercises.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Önce{" "}
                      <Link
                        href={exerciseLibraryHref}
                        className="font-medium text-primary hover:underline"
                      >
                        egzersiz kütüphanene
                      </Link>{" "}
                      egzersiz ekle.
                    </p>
                  ) : (
                    <WorkoutExerciseDialog
                      programId={program.id}
                      workoutId={workout.id}
                      exercises={exercises}
                      add={actions.addWorkoutExercise}
                      update={actions.updateWorkoutExercise}
                      suggest={actions.suggestAlternatives}
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
