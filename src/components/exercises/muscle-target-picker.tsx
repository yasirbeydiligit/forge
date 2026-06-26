"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { ExerciseTargetInput, ExerciseTargetRole } from "@/lib/exercise-targets";
import {
  MUSCLE_REGIONS,
  MUSCLE_REGION_LABELS_TR,
  muscleRoleLabelTr,
  type MuscleRegion,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export type PickerMuscle = { id: string; nameTr: string; region: MuscleRegion };
export type PickerFunction = { id: string; muscleId: string; nameTr: string };

/**
 * "First pick a muscle, then one of its functions, then primary/secondary."
 * Added targets render as removable chips; the whole list is serialised to a
 * hidden JSON field (default name `targets`) that the server action parses with
 * parseExerciseTargets. Shared by the coach and athlete exercise forms.
 */
export function MuscleTargetPicker({
  muscles,
  functions,
  initialTargets = [],
  name = "targets",
}: {
  muscles: PickerMuscle[];
  functions: PickerFunction[];
  initialTargets?: ExerciseTargetInput[];
  name?: string;
}) {
  const [targets, setTargets] = useState<ExerciseTargetInput[]>(initialTargets);
  const [muscleId, setMuscleId] = useState("");
  const [functionId, setFunctionId] = useState("");
  const [role, setRole] = useState<ExerciseTargetRole>("primary");

  const muscleById = useMemo(
    () => new Map(muscles.map((m) => [m.id, m])),
    [muscles],
  );
  const functionById = useMemo(
    () => new Map(functions.map((f) => [f.id, f])),
    [functions],
  );
  const musclesByRegion = useMemo(() => {
    const map = new Map<MuscleRegion, PickerMuscle[]>();
    for (const region of MUSCLE_REGIONS) map.set(region, []);
    for (const m of muscles) map.get(m.region)?.push(m);
    return map;
  }, [muscles]);
  const fnsForMuscle = useMemo(
    () => functions.filter((f) => f.muscleId === muscleId),
    [functions, muscleId],
  );

  const alreadyAdded = (fid: string) =>
    targets.some((t) => t.muscleFunctionId === fid);

  function addTarget() {
    if (!functionId || alreadyAdded(functionId)) return;
    setTargets((prev) => [...prev, { muscleFunctionId: functionId, role }]);
    setFunctionId("");
  }

  function removeTarget(fid: string) {
    setTargets((prev) => prev.filter((t) => t.muscleFunctionId !== fid));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(targets)} />

      {/* Added targets */}
      {targets.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {targets.map((t) => {
            const fn = functionById.get(t.muscleFunctionId);
            const muscle = fn ? muscleById.get(fn.muscleId) : undefined;
            return (
              <li
                key={t.muscleFunctionId}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                  t.role === "primary"
                    ? "border-lab-green/40 bg-lab-green/10 text-paper-foreground"
                    : "border-paper-border bg-paper-foreground/[0.04] text-paper-muted",
                )}
              >
                <span className="font-medium">{fn?.nameTr ?? "Fonksiyon"}</span>
                {muscle ? (
                  <span className="text-xs text-paper-muted">{muscle.nameTr}</span>
                ) : null}
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {muscleRoleLabelTr[t.role]}
                </span>
                <button
                  type="button"
                  onClick={() => removeTarget(t.muscleFunctionId)}
                  className="text-paper-muted hover:text-destructive"
                  aria-label="Hedefi kaldır"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-paper-muted">
          Henüz hedef kas eklenmedi. Önce kas, sonra o kasın fonksiyonunu seç.
        </p>
      )}

      {/* Add row */}
      <div className="grid gap-2 rounded-lg border border-paper-border bg-paper-foreground/[0.02] p-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-paper-muted">Kas</Label>
          <Select
            value={muscleId}
            onValueChange={(v) => {
              setMuscleId(v);
              setFunctionId("");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Kas seç" />
            </SelectTrigger>
            <SelectContent>
              {MUSCLE_REGIONS.map((region) => {
                const items = musclesByRegion.get(region) ?? [];
                if (items.length === 0) return null;
                return (
                  <SelectGroup key={region}>
                    <SelectLabel>{MUSCLE_REGION_LABELS_TR[region]}</SelectLabel>
                    {items.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nameTr}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-paper-muted">Fonksiyon</Label>
          <Select
            value={functionId}
            onValueChange={setFunctionId}
            disabled={!muscleId}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={muscleId ? "Fonksiyon seç" : "Önce kas seç"}
              />
            </SelectTrigger>
            <SelectContent>
              {fnsForMuscle.map((f) => (
                <SelectItem
                  key={f.id}
                  value={f.id}
                  disabled={alreadyAdded(f.id)}
                >
                  {f.nameTr}
                  {alreadyAdded(f.id) ? " · eklendi" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end justify-between gap-2 sm:col-span-2">
          <div className="flex rounded-md border border-paper-border p-0.5">
            {(["primary", "secondary"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "rounded px-3 py-1 text-sm transition-colors",
                  role === r
                    ? "bg-lab-green/15 font-medium text-lab-green"
                    : "text-paper-muted hover:text-paper-foreground",
                )}
              >
                {muscleRoleLabelTr[r]}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTarget}
            disabled={!functionId || alreadyAdded(functionId)}
          >
            <Plus className="size-4" /> Hedef ekle
          </Button>
        </div>
      </div>
    </div>
  );
}
