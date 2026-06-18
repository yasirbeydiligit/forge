"use client";

import { useRef, useState, useTransition } from "react";

import { saveDailyMetric } from "./actions";
import type { DailyMetric } from "@/lib/types";
import { cn } from "@/lib/utils";

type Vals = {
  weight: string;
  sleepHours: string;
  restingHr: string;
  energy: string;
  hunger: string;
  adherence: string;
  notes: string;
};

function toVals(m: DailyMetric | null): Vals {
  return {
    weight: m?.weight != null ? String(m.weight) : "",
    sleepHours: m?.sleep_hours != null ? String(m.sleep_hours) : "",
    restingHr: m?.resting_hr != null ? String(m.resting_hr) : "",
    energy: m?.energy != null ? String(m.energy) : "",
    hunger: m?.hunger != null ? String(m.hunger) : "",
    adherence: m?.adherence != null ? String(m.adherence) : "",
    notes: m?.notes ?? "",
  };
}

const cellInput =
  "h-9 rounded bg-transparent text-center font-mono text-sm tabular-nums text-foreground outline-none transition-colors focus:bg-primary/5";

// Valid ranges per metric; values are clamped to these on blur.
const RANGE: Record<keyof Vals, [number, number] | null> = {
  weight: [0, 300],
  sleepHours: [0, 24],
  restingHr: [0, 250],
  energy: [0, 10],
  hunger: [0, 10],
  adherence: [0, 10],
  notes: null,
};

function clampVals(v: Vals): Vals {
  const out: Vals = { ...v };
  (Object.keys(RANGE) as (keyof Vals)[]).forEach((k) => {
    const r = RANGE[k];
    if (!r || out[k] === "") return;
    const n = Number(out[k]);
    if (Number.isNaN(n)) {
      out[k] = "";
      return;
    }
    const clamped = Math.min(Math.max(n, r[0]), r[1]);
    out[k] = String(clamped);
  });
  return out;
}

export function MetricRow({
  date,
  dayLabel,
  dayNum,
  isToday,
  metric,
}: {
  date: string;
  dayLabel: string;
  dayNum: number;
  isToday: boolean;
  metric: DailyMetric | null;
}) {
  const [vals, setVals] = useState<Vals>(() => toVals(metric));
  const saved = useRef<Vals>(vals);
  const [, startTransition] = useTransition();

  function commit() {
    const next = clampVals(vals);
    if (JSON.stringify(next) !== JSON.stringify(vals)) setVals(next);
    if (JSON.stringify(next) === JSON.stringify(saved.current)) return;
    const fd = new FormData();
    fd.set("date", date);
    fd.set("weight", next.weight);
    fd.set("sleepHours", next.sleepHours);
    fd.set("restingHr", next.restingHr);
    fd.set("energy", next.energy);
    fd.set("hunger", next.hunger);
    fd.set("adherence", next.adherence);
    fd.set("notes", next.notes);
    startTransition(async () => {
      await saveDailyMetric(fd);
      saved.current = next;
    });
  }

  const set = (key: keyof Vals) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals((v) => ({ ...v, [key]: e.target.value }));

  return (
    <tr
      className={cn("border-t border-border/60", isToday && "bg-primary/[0.04]")}
      onBlur={commit}
    >
      <td className="py-1.5 pl-3">
        <span
          className={cn("text-sm font-medium", isToday && "text-primary")}
        >
          {dayLabel}
        </span>{" "}
        <span className="font-mono text-[10px] text-muted-foreground">
          {dayNum}
        </span>
      </td>
      <td>
        <input
          className={cn(cellInput, "w-16")}
          inputMode="decimal"
          placeholder="—"
          value={vals.weight}
          onChange={set("weight")}
          aria-label="Kilo"
        />
      </td>
      <td>
        <input
          className={cn(cellInput, "w-14")}
          inputMode="decimal"
          placeholder="—"
          value={vals.sleepHours}
          onChange={set("sleepHours")}
          aria-label="Uyku"
        />
      </td>
      <td>
        <input
          className={cn(cellInput, "w-12")}
          inputMode="numeric"
          placeholder="—"
          value={vals.restingHr}
          onChange={set("restingHr")}
          aria-label="Dinlenik nabız"
        />
      </td>
      <td>
        <input
          className={cn(cellInput, "w-11")}
          inputMode="numeric"
          placeholder="—"
          value={vals.energy}
          onChange={set("energy")}
          aria-label="Enerji"
        />
      </td>
      <td>
        <input
          className={cn(cellInput, "w-11")}
          inputMode="numeric"
          placeholder="—"
          value={vals.hunger}
          onChange={set("hunger")}
          aria-label="Açlık"
        />
      </td>
      <td>
        <input
          className={cn(cellInput, "w-11")}
          inputMode="numeric"
          placeholder="—"
          value={vals.adherence}
          onChange={set("adherence")}
          aria-label="Uyum"
        />
      </td>
      <td className="pr-2">
        <input
          className={cn(cellInput, "w-full px-2 text-left")}
          placeholder="not…"
          value={vals.notes}
          onChange={set("notes")}
          aria-label="Not"
        />
      </td>
    </tr>
  );
}
