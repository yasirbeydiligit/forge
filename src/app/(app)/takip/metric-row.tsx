"use client";

import { useRef, useState, useTransition } from "react";

import { saveDailyMetric } from "./actions";
import {
  TrendMark,
  VALENCE_CELL,
  VALENCE_TEXT,
  ValenceMark,
} from "./valence-ui";
import {
  getMetric,
  trend,
  valence,
  type MetricKey,
  type Polarity,
} from "@/lib/metrics";
import type { DailyMetric } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Per-cell colouring context computed on the server from the athlete's
 * baseline + goals. `center` is the goal (if set) or the recent mean. */
export type CellConfig = {
  polarity: Polarity;
  center: number | null;
  spread: number;
};

/** Every storable metric, kept in state even when its column is hidden, so
 * toggling a column off never wipes its stored value on the next save. */
const ALL_KEYS: MetricKey[] = [
  "weight",
  "sleep_hours",
  "resting_hr",
  "energy",
  "hunger",
  "adherence",
  "digestion",
  "steps",
  "notes",
];

/** MetricKey → the camelCase field name the save action expects. */
const FIELD: Record<MetricKey, string> = {
  weight: "weight",
  sleep_hours: "sleepHours",
  resting_hr: "restingHr",
  energy: "energy",
  hunger: "hunger",
  adherence: "adherence",
  digestion: "digestion",
  steps: "steps",
  notes: "notes",
};

/** Cell input width per metric (UI concern, kept out of the registry). */
const CELL_WIDTH: Record<MetricKey, string> = {
  weight: "w-16",
  sleep_hours: "w-14",
  resting_hr: "w-12",
  energy: "w-11",
  hunger: "w-11",
  adherence: "w-11",
  digestion: "w-11",
  steps: "w-16",
  notes: "w-full px-2 text-left",
};

type Vals = Record<MetricKey, string>;

function toVals(m: DailyMetric | null): Vals {
  const out = {} as Vals;
  for (const key of ALL_KEYS) {
    const v = m?.[key];
    out[key] = v != null ? String(v) : "";
  }
  return out;
}

function clampVals(v: Vals): Vals {
  const out: Vals = { ...v };
  for (const key of ALL_KEYS) {
    const range = getMetric(key).range;
    if (!range || out[key] === "") continue;
    const n = Number(out[key]);
    if (Number.isNaN(n)) {
      out[key] = "";
      continue;
    }
    out[key] = String(Math.min(Math.max(n, range[0]), range[1]));
  }
  return out;
}

const cellInput =
  "h-9 rounded bg-transparent text-center font-mono text-sm tabular-nums outline-none transition-colors focus:bg-primary/5";

export function MetricRow({
  date,
  dayLabel,
  dayNum,
  isToday,
  metric,
  columns,
  configs,
}: {
  date: string;
  dayLabel: string;
  dayNum: number;
  isToday: boolean;
  metric: DailyMetric | null;
  /** Enabled metric keys, in display order (notes handled separately). */
  columns: MetricKey[];
  configs: Partial<Record<MetricKey, CellConfig>>;
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
    for (const key of ALL_KEYS) fd.set(FIELD[key], next[key]);
    startTransition(async () => {
      await saveDailyMetric(fd);
      saved.current = next;
    });
  }

  const set = (key: MetricKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVals((v) => ({ ...v, [key]: e.target.value }));

  // Enter moves to the next cell in the row (mobile-friendly fast entry).
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      e.currentTarget.closest("tr")?.querySelectorAll("input") ?? [],
    );
    const i = inputs.indexOf(e.currentTarget);
    const nextEl = inputs[i + 1];
    if (nextEl) nextEl.focus();
    else e.currentTarget.blur();
  }

  // Show notes last and separate from the numeric/coloured columns.
  const numericCols = columns.filter((k) => k !== "notes");
  const showNotes = columns.includes("notes");

  return (
    <tr
      className={cn("border-t border-border/60", isToday && "bg-primary/[0.04]")}
      onBlur={commit}
    >
      <td className="py-1.5 pl-3">
        <span className={cn("text-sm font-medium", isToday && "text-primary")}>
          {dayLabel}
        </span>{" "}
        <span className="font-mono text-[10px] text-muted-foreground">
          {dayNum}
        </span>
      </td>

      {numericCols.map((key) => {
        const def = getMetric(key);
        const cfg = configs[key];
        const raw = vals[key];
        const n = raw === "" ? null : Number(raw);

        let v: ReturnType<typeof valence> = "none";
        let t: ReturnType<typeof trend> = "none";
        if (cfg && n != null && Number.isFinite(n)) {
          if (cfg.polarity === "trend") t = trend(n, cfg.center);
          else v = valence(n, cfg);
        }

        return (
          <td key={key} className={cn("relative px-0.5", VALENCE_CELL[v])}>
            <input
              className={cn(cellInput, CELL_WIDTH[key], VALENCE_TEXT[v])}
              inputMode={def.inputMode === "text" ? undefined : def.inputMode}
              enterKeyHint="next"
              placeholder="—"
              value={raw}
              onChange={set(key)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={onKeyDown}
              aria-label={def.label}
            />
            <span className="pointer-events-none absolute right-0.5 top-1">
              {cfg?.polarity === "trend" ? (
                <TrendMark trend={t} />
              ) : (
                <ValenceMark valence={v} />
              )}
            </span>
          </td>
        );
      })}

      {showNotes ? (
        <td className="pr-2">
          <input
            className={cn(cellInput, CELL_WIDTH.notes, "text-foreground")}
            placeholder="not…"
            value={vals.notes}
            onChange={set("notes")}
            onKeyDown={onKeyDown}
            aria-label="Not"
          />
        </td>
      ) : null}
    </tr>
  );
}
