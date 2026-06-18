"use client";

import { useOptimistic, useTransition } from "react";
import { Droplet, Minus, Plus } from "lucide-react";

import { adjustWater } from "./actions";
import { PaperCard, SectionLabel } from "@/components/lab/lab";

const STEP = 250; // one glass, in millilitres

/**
 * Hydration for the day: a glass that fills toward the daily goal with a soft
 * motion-token transition, logged a glass at a time. Uses an optimistic value
 * so the fill responds instantly, then settles on the revalidated server value.
 */
export function WaterTracker({
  date,
  current,
  target,
}: {
  date: string;
  current: number;
  target: number | null;
}) {
  const goal = target && target > 0 ? target : 3000;
  const [value, addOptimistic] = useOptimistic(
    current,
    (state, delta: number) => Math.max(0, state + delta),
  );
  const [, startTransition] = useTransition();

  const pct = Math.min(100, (value / goal) * 100);
  const glasses = Math.round(value / STEP);
  const goalGlasses = Math.round(goal / STEP);
  const fmtL = (ml: number) =>
    (ml / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 });

  function change(delta: number) {
    startTransition(async () => {
      addOptimistic(delta);
      const fd = new FormData();
      fd.set("date", date);
      fd.set("delta", String(delta));
      await adjustWater(fd);
    });
  }

  return (
    <PaperCard className="flex items-center gap-5 p-5">
      {/* Filling glass */}
      <div className="relative h-24 w-14 shrink-0 overflow-hidden rounded-md rounded-b-2xl border-2 border-lab-blue/30 bg-lab-blue/[0.04]">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 bg-lab-blue/25 transition-[height] duration-[var(--dur-slow)] ease-soft"
          style={{ height: `${pct}%` }}
        >
          <span className="absolute inset-x-0 top-0 h-[3px] bg-lab-blue/45" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Droplet className="size-4 text-lab-blue/70" />
        </div>
      </div>

      {/* Numbers + controls */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel className="text-paper-muted">Hidrasyon</SectionLabel>
          <span className="font-mono text-xs tabular-nums text-paper-muted">
            {glasses} / {goalGlasses} bardak
          </span>
        </div>
        <p className="mt-1 font-serif text-3xl tabular-nums text-paper-foreground">
          {fmtL(value)}
          <span className="text-xl text-paper-muted"> / {fmtL(goal)}</span>
          <span className="ml-1 text-sm font-normal text-paper-muted">L</span>
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => change(STEP)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-lab-blue/10 px-4 text-sm font-medium text-lab-blue transition-[background-color,transform] duration-[var(--dur-fast)] ease-soft hover:bg-lab-blue/15 active:scale-[0.98]"
          >
            <Plus className="size-4" />
            1 bardak
            <span className="font-mono text-xs opacity-70">+250 ml</span>
          </button>
          <button
            type="button"
            onClick={() => change(-STEP)}
            disabled={value <= 0}
            aria-label="Bir bardak geri al"
            className="inline-flex size-11 items-center justify-center rounded-full border border-paper-border text-paper-muted transition-colors duration-[var(--dur-fast)] hover:text-foreground disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
        </div>
      </div>
    </PaperCard>
  );
}
