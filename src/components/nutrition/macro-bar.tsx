"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const ACCENTS = {
  green: "bg-lab-green",
  amber: "bg-lab-amber",
  violet: "bg-lab-violet",
} as const;

/**
 * A macro progress bar that tells the story by filling, not just by number.
 * Fills from 0 → target ratio on mount (a soft motion-token transition; the
 * global reduced-motion rule flattens it), shows the percentage, and marks an
 * over-target overflow with a deeper cap so going past goal reads at a glance.
 */
export function MacroBar({
  label,
  value,
  target,
  accent,
}: {
  label: string;
  value: number;
  target: number | null;
  accent: keyof typeof ACCENTS;
}) {
  const ratio = target && target > 0 ? value / target : 0;
  const pct = Math.round(ratio * 100);
  const over = ratio > 1;

  // Animate the fill in on mount: start empty, then grow to the real width.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const fill = grown ? Math.min(100, ratio * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-paper-muted">{label}</span>
        <span className="font-mono tabular-nums text-paper-foreground">
          {value}g
          {target ? <span className="text-paper-muted"> / {target}g</span> : null}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-foreground/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-soft",
            ACCENTS[accent],
            over && "opacity-90",
          )}
          style={{ width: `${fill}%` }}
        />
      </div>
      {target ? (
        <p className="mt-1 font-mono text-[10px] tabular-nums text-paper-muted">
          {over ? (
            <span className="text-paper-foreground">%{pct} · hedefin üzerinde</span>
          ) : (
            <span>%{pct}</span>
          )}
        </p>
      ) : null}
    </div>
  );
}
