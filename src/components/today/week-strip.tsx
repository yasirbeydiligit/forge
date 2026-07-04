"use client";

/**
 * The Bugün weekly calendar strip: seven day cells, today emphasised with a
 * soft breathing ring, each carrying its state — planned (muscle-group colour
 * dot), completed (primary check), or rest. Tapping a day opens that day's
 * workout. Pure state comes from buildWeekStrip; this is the renderer.
 */
import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Check } from "lucide-react";

import type { WeekDayCell } from "@/lib/today/week-strip";
import { WEEKDAY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { workoutColor } from "@/lib/workout-color";

export function WeekStrip({ cells }: { cells: WeekDayCell[] }) {
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.to(ring, {
        opacity: 0.35,
        scale: 1.12,
        duration: 1.6,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        transformOrigin: "center",
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {cells.map((cell, i) => {
        const dayNum = Number(cell.date.slice(8, 10));
        const label = WEEKDAY_LABELS[i] ?? "";
        const stripe = cell.planned
          ? workoutColor(cell.workoutNames[0] ?? "")
          : null;

        return (
          <Link
            key={cell.date}
            href={`/antrenman/${cell.date}`}
            aria-current={cell.isToday ? "date" : undefined}
            aria-label={`${label} ${dayNum}${
              cell.completed
                ? ", tamamlandı"
                : cell.planned
                  ? `, planlı: ${cell.workoutNames.join(", ") || "antrenman"}`
                  : ""
            }`}
            className={cn(
              "group relative flex min-w-11 flex-1 flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-[background-color,box-shadow,transform] duration-[var(--dur-base)] ease-soft active:scale-[0.97]",
              cell.isToday
                ? "border-primary/30 bg-primary/[0.06]"
                : cell.completed
                  ? "border-primary/20 bg-primary/[0.04]"
                  : "border-paper-border bg-card hover:bg-surface",
              cell.isPast && !cell.completed && "opacity-60",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-paper-muted">
              {label}
            </span>

            <span className="relative flex size-7 items-center justify-center">
              {cell.isToday ? (
                <span
                  ref={ringRef}
                  aria-hidden
                  className="absolute inset-0 rounded-full ring-2 ring-primary"
                />
              ) : null}
              <span
                className={cn(
                  "font-serif text-base leading-none tabular-nums",
                  cell.isToday ? "text-primary" : "text-paper-foreground",
                )}
              >
                {dayNum}
              </span>
            </span>

            {/* Status glyph: check (done) beats dot (planned) beats empty. */}
            <span className="flex h-3.5 items-center justify-center">
              {cell.completed ? (
                <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              ) : stripe ? (
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: stripe }}
                />
              ) : (
                <span aria-hidden className="size-1.5 rounded-full bg-transparent" />
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
