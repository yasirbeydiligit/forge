"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Timer, X } from "lucide-react";

import { logSet } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A spreadsheet-style "next set" row that logs a set, resets its inputs and
 * starts a rest-timer countdown (when the exercise has a rest target). */
export function AddSetForm({
  date,
  assignmentId,
  workoutId,
  exerciseId,
  workoutExerciseId,
  nextSetNumber,
  restSeconds,
  weightPlaceholder,
  repsPlaceholder,
}: {
  date: string;
  assignmentId: string;
  workoutId: string;
  exerciseId: string;
  workoutExerciseId: string;
  nextSetNumber: number;
  restSeconds?: number | null;
  weightPlaceholder?: string;
  repsPlaceholder?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (restEnd == null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= restEnd) {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(200);
        }
        setRestEnd(null);
      }
    }, 250);
    return () => clearInterval(id);
  }, [restEnd]);

  const total = (restSeconds ?? 0) * 1000;
  const remaining = restEnd ? Math.max(0, restEnd - now) : 0;
  const pct = total > 0 ? (remaining / total) * 100 : 0;

  return (
    <div className="space-y-2">
      {restEnd != null ? (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
          <Timer className="size-3.5 shrink-0" />
          <span className="font-mono tabular-nums">{fmt(remaining)}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setRestEnd(null)}
            className="shrink-0 hover:text-foreground"
            aria-label="Dinlenmeyi geç"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <form
        ref={formRef}
        action={async (formData) => {
          await logSet(formData);
          formRef.current?.reset();
          if (restSeconds && restSeconds > 0) {
            setNow(Date.now());
            setRestEnd(Date.now() + restSeconds * 1000);
          }
        }}
        className="grid grid-cols-[1.75rem_1fr_1fr_1fr_2rem] items-center gap-2 border-t border-dashed border-border/70 pt-2"
      >
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="workoutId" value={workoutId} />
        <input type="hidden" name="exerciseId" value={exerciseId} />
        <input type="hidden" name="workoutExerciseId" value={workoutExerciseId} />

        <span className="text-center font-mono text-xs text-muted-foreground">
          {nextSetNumber}
        </span>
        <Input
          name="weight"
          type="number"
          inputMode="decimal"
          step="0.5"
          min={0}
          placeholder={weightPlaceholder ?? "kg"}
          className="h-9 text-center font-mono tabular-nums"
          aria-label="Ağırlık (kg)"
        />
        <Input
          name="reps"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={repsPlaceholder ?? "tekrar"}
          className="h-9 text-center font-mono tabular-nums"
          aria-label="Tekrar"
        />
        <Input
          name="rpe"
          type="number"
          inputMode="decimal"
          step="0.5"
          min={0}
          max={10}
          placeholder="rpe"
          className="h-9 text-center font-mono tabular-nums"
          aria-label="RPE"
        />
        <SubmitButton
          size="icon"
          className="size-8 justify-self-center"
          aria-label="Set ekle"
        >
          <Plus className="size-4" />
        </SubmitButton>
      </form>
    </div>
  );
}
