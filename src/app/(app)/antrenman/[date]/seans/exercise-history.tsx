"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Sparkline } from "@/components/logbook/sparkline";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { PlayerStats } from "./player-data";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-2 text-center">
      <p className="font-mono text-[15px] tabular-nums text-paper-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-paper-muted">{label}</p>
    </div>
  );
}

/** "What did I do last time" — the historical context block, collapsible so it
 * never crowds the active set, but one tap away for progressive overload. */
export function ExerciseHistory({ stats }: { stats: PlayerStats }) {
  const [open, setOpen] = useState(false);
  const hasHistory = stats.recentSessions.length > 0;
  if (!hasHistory) return null;

  return (
    <div className="rounded-xl border border-paper-border bg-paper">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5"
        aria-expanded={open}
      >
        <span className="text-label text-paper-muted">Geçmiş</span>
        <span className="flex items-center gap-2 font-mono text-xs tabular-nums text-paper-muted">
          {stats.allTimePr != null ? <span>PR {stats.allTimePr}</span> : null}
          {stats.recentSessions[0] ? (
            <span className="text-paper-foreground">son · {stats.recentSessions[0].scheme}</span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-[var(--dur-base)] ease-soft",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {open ? (
        <div className="border-t border-paper-border p-3">
          <div className="grid grid-cols-4 divide-x divide-paper-border">
            <Stat label="tah. 1RM" value={stats.bestEst1RM ?? "—"} />
            <Stat label="PR kg" value={stats.allTimePr ?? "—"} />
            <Stat label="hacim·4h" value={stats.volume4w.toLocaleString("tr-TR")} />
            <Stat label="RIR·4h" value={stats.avgRir4w ?? "—"} />
          </div>

          <div className="mt-3 flex items-start justify-between gap-3 border-t border-paper-border pt-3">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-paper-muted">
                Son seanslar
              </p>
              <ul className="space-y-0.5 font-mono text-xs text-paper-foreground">
                {stats.recentSessions.slice(0, 3).map((s) => (
                  <li key={s.date} className="flex justify-between gap-3">
                    <span className="text-paper-muted">{formatDate(s.date, "d MMM")}</span>
                    <span className="tabular-nums">{s.scheme}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="shrink-0 text-right">
              <Sparkline points={stats.trendPoints} />
              {stats.trendDelta != null ? (
                <p
                  className={cn(
                    "mt-1 font-mono text-xs tabular-nums",
                    stats.trendDelta >= 0 ? "text-lab-green" : "text-lab-amber",
                  )}
                >
                  {stats.trendDelta >= 0 ? "+" : ""}
                  {stats.trendDelta} kg · 28g
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
