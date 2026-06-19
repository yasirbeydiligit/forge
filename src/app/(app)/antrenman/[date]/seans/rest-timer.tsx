"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Timer, X } from "lucide-react";

import { cn } from "@/lib/utils";

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact rest countdown: a tinted bar whose background "drains" as time
 * passes, plus a shrinking ring and a large mono countdown. Lives in the
 * footer so it never blocks the flow — the athlete can log the next set while
 * it runs, skip it, or add/remove time. Fires `onDone` once at zero.
 */
export function RestTimer({
  endsAt,
  totalSeconds,
  onDone,
  onSkip,
  onExtend,
}: {
  endsAt: number;
  totalSeconds: number;
  onDone: () => void;
  onSkip: () => void;
  onExtend: (seconds: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (Date.now() < endsAt) firedRef.current = false;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt && !firedRef.current) {
        firedRef.current = true;
        onDone();
      }
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, onDone]);

  const remaining = Math.max(0, endsAt - now);
  const total = Math.max(1, totalSeconds * 1000);
  const pct = Math.min(1, remaining / total);
  const done = remaining === 0;

  const size = 50;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border",
        done ? "border-lab-green/30 forge-rest-done" : "border-primary/20",
      )}
    >
      {/* Draining background fill (shrinks left→right as the rest elapses). */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 transition-[width] duration-300 ease-linear",
          done ? "bg-lab-green/10" : "bg-primary/10",
        )}
        style={{ width: `${pct * 100}%` }}
      />
      <div className={cn("absolute inset-0", done ? "bg-lab-green/[0.04]" : "bg-primary/[0.03]")} />

      <div className="relative z-10 flex items-center gap-3 px-3 py-2.5">
        <svg width={size} height={size} className="-rotate-90 shrink-0">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={done ? "var(--lab-green)" : "var(--primary)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 250ms linear" }}
          />
        </svg>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.16em]",
              done ? "text-lab-green" : "text-muted-foreground",
            )}
          >
            <Timer className="size-3" />
            {done ? "Dinlenme bitti" : "Dinlenme"}
          </p>
          <p className="font-mono text-2xl font-semibold leading-none tabular-nums text-foreground">
            {fmt(remaining)}
          </p>
        </div>

        <div className="flex items-center overflow-hidden rounded-full border border-border bg-background/60">
          <button
            type="button"
            onClick={() => onExtend(-30)}
            aria-label="30 saniye azalt"
            className="inline-flex h-9 items-center gap-0.5 px-2.5 font-mono text-xs text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
          >
            <Minus className="size-3.5" />
            30
          </button>
          <span className="h-5 w-px bg-border" aria-hidden />
          <button
            type="button"
            onClick={() => onExtend(30)}
            aria-label="30 saniye ekle"
            className="inline-flex h-9 items-center gap-0.5 px-2.5 font-mono text-xs text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
          >
            <Plus className="size-3.5" />
            30
          </button>
        </div>
        <button
          type="button"
          onClick={onSkip}
          aria-label={done ? "Kapat" : "Dinlenmeyi geç"}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
