"use client";

import { useState } from "react";

import { computeKcal, kcalMismatch } from "@/lib/nutrition/macros";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type MealFieldsInitial = {
  name?: string;
  eatenAt?: string;
  description?: string | null;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

const numStr = (v: number | null | undefined) => (v == null ? "" : String(v));
const toNum = (s: string) => (s.trim() === "" ? null : Number(s));

/**
 * The controlled meal-entry fields (name, time, foods, macros) shared by every
 * meal-entry surface. kcal is auto-derived from macros via 4/4/9 and shown live,
 * but the athlete can override it; a divergent manual value triggers a gentle,
 * non-blocking hint. Re-initialise by remounting with a new `key` (used to
 * prefill from a saved template).
 */
export function MealFields({
  initial,
  showSaveAsTemplate = false,
}: {
  initial?: MealFieldsInitial;
  showSaveAsTemplate?: boolean;
}) {
  const [protein, setProtein] = useState(numStr(initial?.protein));
  const [carbs, setCarbs] = useState(numStr(initial?.carbs));
  const [fat, setFat] = useState(numStr(initial?.fat));
  const [kcal, setKcal] = useState(numStr(initial?.kcal));
  // "Touched" means the athlete typed an explicit kcal; until then we mirror the
  // 4/4/9 estimate so the field always shows (and submits) a sensible value.
  const [kcalTouched, setKcalTouched] = useState(initial?.kcal != null);

  const auto = computeKcal(toNum(protein), toNum(carbs), toNum(fat));
  const effectiveKcal = kcalTouched ? kcal : auto > 0 ? String(auto) : "";
  const mismatch = kcalTouched
    ? kcalMismatch(toNum(kcal), toNum(protein), toNum(carbs), toNum(fat))
    : null;

  return (
    <>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div className="space-y-2">
          <Label htmlFor="name">Öğün</Label>
          <Input
            id="name"
            name="name"
            placeholder="Kahvaltı"
            required
            autoComplete="off"
            defaultValue={initial?.name ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eatenAt">Saat</Label>
          <Input
            id="eatenAt"
            name="eatenAt"
            type="time"
            defaultValue={initial?.eatenAt ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Yiyecekler</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="3 yumurta · 80g yulaf · muz · kahve"
          rows={2}
          defaultValue={initial?.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-2">
          <Label htmlFor="kcal" className="flex items-baseline gap-1">
            kcal
            {!kcalTouched && auto > 0 ? (
              <span className="font-mono text-[10px] uppercase tracking-wide text-lab-green">
                oto
              </span>
            ) : null}
          </Label>
          <Input
            id="kcal"
            name="kcal"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="620"
            value={effectiveKcal}
            onChange={(e) => {
              const v = e.target.value;
              setKcal(v);
              setKcalTouched(v.trim() !== "");
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="protein">Pro</Label>
          <Input
            id="protein"
            name="protein"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="38"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="carbs">Karb</Label>
          <Input
            id="carbs"
            name="carbs"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="62"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fat">Yağ</Label>
          <Input
            id="fat"
            name="fat"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="18"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </div>
      </div>

      {mismatch ? (
        <p className="text-caption text-lab-amber">
          Makrolardan ≈{auto} kcal bekleniyor. Fark normal olabilir (lif/şeker
          alkolü); istersen düzeltmeden ekleyebilirsin.
        </p>
      ) : null}

      {showSaveAsTemplate ? (
        <label className="flex items-center gap-2 text-sm text-paper-foreground">
          <input
            type="checkbox"
            name="saveAsTemplate"
            className="size-4 rounded border-paper-border accent-lab-green"
          />
          Bu öğünü hazır öğünlerime kaydet
        </label>
      ) : null}
    </>
  );
}
