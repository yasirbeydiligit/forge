"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Repeat2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { AlternativeSuggestion, FormAction } from "./types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EQUIPMENT_TYPE_LABELS_TR,
  MOVEMENT_PATTERN_LABELS_TR,
  RIR_HELP_TR,
} from "@/lib/taxonomy";
import type { Exercise, WorkoutExercise } from "@/lib/types";

/**
 * Shared "add/edit a workout exercise" dialog. The exercise picker lists system
 * and the user's own ("Özel") exercises in one grouped select, and offers a
 * "Muadil göster" action backed by suggest_exercise_alternatives — picking a
 * suggestion just swaps the selected exercise (muscle/function tracking stays
 * continuous because the alternative shares the same primary targets).
 */
export function WorkoutExerciseDialog({
  programId,
  workoutId,
  exercises,
  add,
  update,
  suggest,
  workoutExercise,
  trigger,
}: {
  programId: string;
  workoutId: string;
  exercises: Exercise[];
  add: FormAction;
  update: FormAction;
  suggest: (exerciseId: string) => Promise<AlternativeSuggestion[]>;
  workoutExercise?: WorkoutExercise;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(workoutExercise);
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState(
    workoutExercise?.exercise_id ?? "",
  );
  const [alts, setAlts] = useState<AlternativeSuggestion[] | null>(null);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [state, formAction, isPending] = useActionState(
    isEdit ? update : add,
    {},
  );

  const { system, own } = useMemo(() => {
    const system: Exercise[] = [];
    const own: Exercise[] = [];
    for (const ex of exercises) (ex.is_system ? system : own).push(ex);
    return { system, own };
  }, [exercises]);
  const exerciseName = useMemo(
    () => exercises.find((e) => e.id === exerciseId)?.name ?? "",
    [exercises, exerciseId],
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(isEdit ? "Egzersiz güncellendi." : "Egzersiz eklendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, isEdit]);

  // Reset the alternatives panel whenever the chosen exercise changes.
  useEffect(() => {
    setAlts(null);
  }, [exerciseId]);

  async function showAlternatives() {
    if (!exerciseId) return;
    setLoadingAlts(true);
    try {
      setAlts(await suggest(exerciseId));
    } catch {
      toast.error("Muadiller yüklenemedi.");
    } finally {
      setLoadingAlts(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <Plus className="size-4" /> Egzersiz
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Egzersizi düzenle" : "Antrenmana egzersiz ekle"}
          </DialogTitle>
          <DialogDescription>
            Hedef set, tekrar ve ağırlık/RIR değerlerini belirle.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="workoutId" value={workoutId} />
          <input type="hidden" name="exerciseId" value={exerciseId} />
          {isEdit ? (
            <input type="hidden" name="id" value={workoutExercise!.id} />
          ) : null}

          <div className="space-y-2">
            <Label>Egzersiz</Label>
            <Select value={exerciseId} onValueChange={setExerciseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Egzersiz seç" />
              </SelectTrigger>
              <SelectContent>
                {system.length ? (
                  <SelectGroup>
                    <SelectLabel>Sistem egzersizleri</SelectLabel>
                    {system.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name}
                        {ex.category ? ` · ${ex.category}` : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {own.length ? (
                  <SelectGroup>
                    <SelectLabel>Özel egzersizlerim</SelectLabel>
                    {own.map((ex) => (
                      <SelectItem key={ex.id} value={ex.id}>
                        {ex.name} · Özel
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>

            {exerciseId ? (
              <div className="rounded-lg border border-paper-border bg-paper-foreground/[0.02] p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={showAlternatives}
                  disabled={loadingAlts}
                  className="h-auto px-2 py-1 text-xs"
                >
                  <Sparkles className="size-3.5" />
                  {loadingAlts ? "Muadiller aranıyor…" : "Muadil göster"}
                </Button>

                {alts != null ? (
                  alts.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-paper-muted">
                      {exerciseName} için uygun muadil bulunamadı.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {alts.map((a) => (
                        <li key={a.exerciseId}>
                          <button
                            type="button"
                            onClick={() => setExerciseId(a.exerciseId)}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-paper-foreground/[0.05]"
                          >
                            <span className="flex items-center gap-1.5 text-paper-foreground">
                              <Repeat2 className="size-3.5 text-lab-green" />
                              {a.name}
                            </span>
                            <span className="shrink-0 text-[11px] text-paper-muted">
                              {a.equipmentType
                                ? EQUIPMENT_TYPE_LABELS_TR[a.equipmentType]
                                : a.movementPattern
                                  ? MOVEMENT_PATTERN_LABELS_TR[a.movementPattern]
                                  : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetSets">Set</Label>
              <Input
                id="targetSets"
                name="targetSets"
                type="number"
                min={0}
                defaultValue={workoutExercise?.target_sets ?? ""}
                placeholder="4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetRepsMin">Tekrar (min)</Label>
              <Input
                id="targetRepsMin"
                name="targetRepsMin"
                type="number"
                min={0}
                defaultValue={workoutExercise?.target_reps_min ?? ""}
                placeholder="8"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetRepsMax">Tekrar (max)</Label>
              <Input
                id="targetRepsMax"
                name="targetRepsMax"
                type="number"
                min={0}
                defaultValue={workoutExercise?.target_reps_max ?? ""}
                placeholder="12"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetWeight">Ağırlık (kg)</Label>
              <Input
                id="targetWeight"
                name="targetWeight"
                type="number"
                step="0.5"
                min={0}
                defaultValue={workoutExercise?.target_weight ?? ""}
                placeholder="60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetRir">RIR</Label>
              <Input
                id="targetRir"
                name="targetRir"
                type="number"
                step="0.5"
                min={0}
                max={10}
                defaultValue={workoutExercise?.target_rir ?? ""}
                placeholder="2"
                title={RIR_HELP_TR}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restSeconds">Dinlenme (sn)</Label>
              <Input
                id="restSeconds"
                name="restSeconds"
                type="number"
                min={0}
                step={15}
                defaultValue={workoutExercise?.rest_seconds ?? ""}
                placeholder="120"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="we-notes">Not</Label>
            <Textarea
              id="we-notes"
              name="notes"
              defaultValue={workoutExercise?.notes ?? ""}
              placeholder="Tempo, teknik ipucu vb. (opsiyonel)"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !exerciseId}>
              {isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
