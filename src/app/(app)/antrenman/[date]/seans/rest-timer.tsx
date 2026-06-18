"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact rest countdown: a shrinking ring + large mono time that lives in the
 * footer so it never blocks the flow — the athlete can log the next set while
 * it runs, skip it, or add time. Fires `onDone` once when it reaches zero.
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

  const size = 52;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-paper-border bg-paper px-3 py-2 ${done ? "forge-rest-done" : ""}`}
    >
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
        <p className={`text-label ${done ? "text-lab-green" : "text-muted-foreground"}`}>
          {done ? "Dinlenme bitti" : "Dinlenme"}
        </p>
        <p className="font-mono text-2xl leading-none tabular-nums text-foreground">
          {fmt(remaining)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onExtend(30)}
        aria-label="30 saniye ekle"
        className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-2.5 font-mono text-xs text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
      >
        <Plus className="size-3.5" />
        30
      </button>
      <button
        type="button"
        onClick={onSkip}
        aria-label={done ? "Kapat" : "Dinlenmeyi geç"}
        className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
