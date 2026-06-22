"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  addWorkoutExercise,
  updateWorkoutExercise,
  type FormState,
} from "../actions";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Exercise, WorkoutExercise } from "@/lib/types";

export function WorkoutExerciseDialog({
  programId,
  workoutId,
  exercises,
  workoutExercise,
  trigger,
}: {
  programId: string;
  workoutId: string;
  exercises: Exercise[];
  workoutExercise?: WorkoutExercise;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(workoutExercise);
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState(
    workoutExercise?.exercise_id ?? "",
  );
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    isEdit ? updateWorkoutExercise : addWorkoutExercise,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(isEdit ? "Egzersiz güncellendi." : "Egzersiz eklendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, isEdit]);

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
                <SelectValue placeholder="Kütüphaneden seç" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.name}
                    {ex.category ? ` · ${ex.category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                title="RIR = Yedekte kalan tekrar (0 = tam başarısızlık)"
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
