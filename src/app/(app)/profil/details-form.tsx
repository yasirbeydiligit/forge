"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { updateDetails, type FormState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GOAL_OPTIONS,
  SEX_OPTIONS,
  UNIT_OPTIONS,
  type SexKey,
  type TrainingGoalKey,
  type WeightUnitKey,
} from "@/lib/profile";
import type { ProfileDetails } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Selected/idle looks for the pill pickers (editorial, calm green accent). */
const pill = (active: boolean) =>
  cn(
    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
    active
      ? "border-lab-green/40 bg-lab-green/10 text-lab-green"
      : "border-border text-muted-foreground hover:text-foreground",
  );

export function DetailsForm({ details }: { details: ProfileDetails | null }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateDetails,
    {},
  );
  const [sex, setSex] = useState<SexKey | "">(details?.sex ?? "");
  const [goal, setGoal] = useState<TrainingGoalKey | "">(details?.goal ?? "");
  const [unit, setUnit] = useState<WeightUnitKey>(details?.unit ?? "kg");
  const [days, setDays] = useState<number | null>(
    details?.weekly_target_days ?? null,
  );

  useEffect(() => {
    if (state.ok) toast.success("Bilgiler kaydedildi.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {/* Toggleable choices submit through hidden inputs. */}
      <input type="hidden" name="sex" value={sex} />
      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="weeklyTargetDays" value={days ?? ""} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="heightCm">Boy</Label>
          <div className="flex items-center gap-2">
            <Input
              id="heightCm"
              name="heightCm"
              inputMode="numeric"
              placeholder="—"
              defaultValue={details?.height_cm ?? ""}
              className="font-mono tabular-nums"
            />
            <span className="font-mono text-sm text-muted-foreground">cm</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthDate">Doğum tarihi</Label>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={details?.birth_date ?? ""}
            className="font-mono tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cinsiyet</Label>
        <div className="flex flex-wrap gap-2">
          {SEX_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={pill(sex === o.key)}
              onClick={() => setSex((prev) => (prev === o.key ? "" : o.key))}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/60" />

      <div className="space-y-2">
        <Label>Hedef</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((o) => {
            const active = goal === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() =>
                  setGoal((prev) => (prev === o.key ? "" : o.key))
                }
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-lab-green/40 bg-lab-green/[0.07]"
                    : "border-border hover:border-lab-green/30",
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-medium",
                    active ? "text-lab-green" : "text-foreground",
                  )}
                >
                  {o.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {o.hint}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Hedefin, takipteki kilo renklendirmesini ve koç panelini besler.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Haftalık antrenman günü</Label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDays((prev) => (prev === n ? null : n))}
              className={cn(
                "size-9 rounded-full border font-mono text-sm tabular-nums transition-colors",
                days === n
                  ? "border-lab-green/40 bg-lab-green/10 text-lab-green"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Birim</Label>
        <div className="flex flex-wrap gap-2">
          {UNIT_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={pill(unit === o.key)}
              onClick={() => setUnit(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Tercih kaydedilir; görünüm bu fazda kg üzerinden.
        </p>
      </div>

      <SubmitButton>Kaydet</SubmitButton>
    </form>
  );
}
