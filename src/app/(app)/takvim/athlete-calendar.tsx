"use client";

import { useMemo } from "react";
import Link from "next/link";
import { isSameMonth, isToday } from "date-fns";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildMonthMatrix, parseMonthKey } from "@/lib/calendar";
import { toDateKey, WEEKDAY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { workoutColor } from "@/lib/workout-color";

export type AthleteAssignmentView = {
  id: string;
  scheduled_date: string;
  workout: { name: string } | null;
};

export function AthleteCalendar({
  monthKey,
  monthLabel,
  prevKey,
  nextKey,
  assignments,
  completedDates,
}: {
  monthKey: string;
  monthLabel: string;
  prevKey: string;
  nextKey: string;
  assignments: AthleteAssignmentView[];
  completedDates: string[];
}) {
  const month = useMemo(() => parseMonthKey(monthKey), [monthKey]);
  const weeks = useMemo(() => buildMonthMatrix(month), [month]);
  const completed = useMemo(() => new Set(completedDates), [completedDates]);

  const byDate = useMemo(() => {
    const map = new Map<string, AthleteAssignmentView[]>();
    for (const a of assignments) {
      if (!map.has(a.scheduled_date)) map.set(a.scheduled_date, []);
      map.get(a.scheduled_date)!.push(a);
    }
    return map;
  }, [assignments]);

  const days = useMemo(() => weeks.flat(), [weeks]);

  // Mobile agenda: only the days that carry weight (planned / done / today),
  // in order — a tidy vertical list instead of a cramped 7-column grid.
  const agendaDays = useMemo(
    () =>
      days.filter((day) => {
        if (!isSameMonth(day, month)) return false;
        const key = toDateKey(day);
        return (byDate.get(key)?.length ?? 0) > 0 || completed.has(key) || isToday(day);
      }),
    [days, month, byDate, completed],
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-h2 capitalize text-lab-ink">{monthLabel}</h2>
        <div className="flex gap-1.5">
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <Link href={`/takvim?month=${prevKey}`} aria-label="Önceki ay">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <Link href={`/takvim?month=${nextKey}`} aria-label="Sonraki ay">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Desktop / tablet: month grid of paper tiles */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="text-label pb-1 text-center text-muted-foreground">
              {d}
            </div>
          ))}

          {days.map((day) => {
            const key = toDateKey(day);
            const inMonth = isSameMonth(day, month);
            const dayAssignments = byDate.get(key) ?? [];
            const isDone = completed.has(key);
            const hasWork = dayAssignments.length > 0;
            const today = isToday(day);
            const stripe = hasWork ? workoutColor(dayAssignments[0].workout?.name) : null;

            return (
              <Link
                key={key}
                href={`/antrenman/${key}`}
                aria-current={today ? "date" : undefined}
                className={cn(
                  "group relative flex min-h-28 flex-col overflow-hidden rounded-lg border p-2 transition-[transform,box-shadow,background-color] duration-[var(--dur-base)] ease-soft",
                  !inMonth && "border-transparent bg-transparent opacity-40",
                  inMonth && !hasWork && !isDone && "border-paper-border bg-card",
                  inMonth && hasWork && !isDone && "border-paper-border bg-surface",
                  isDone && "border-primary/25 bg-primary/[0.06]",
                  inMonth && (hasWork || isDone) && "hover:-translate-y-0.5 hover:shadow-raised",
                  today && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {/* Planned-but-not-done days carry a muscle-group colour stripe. */}
                {stripe && !isDone ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                    style={{ backgroundColor: stripe }}
                  />
                ) : null}

                <div className="flex items-center justify-between">
                  {today ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-primary-foreground">
                      {day.getDate()}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        inMonth ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {day.getDate()}
                    </span>
                  )}
                  {isDone ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </div>

                <div className="mt-1.5 space-y-1">
                  {dayAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1.5 text-[11px] font-medium leading-tight text-foreground/80"
                    >
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: workoutColor(a.workout?.name) }}
                      />
                      <span className="truncate">{a.workout?.name}</span>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        <CalendarLegend />
      </div>

      {/* Mobile: vertical agenda */}
      <ul className="space-y-2 sm:hidden">
        {agendaDays.length === 0 ? (
          <li className="rounded-lg border border-paper-border bg-card p-5 text-center text-sm text-muted-foreground">
            Bu ay planlanmış antrenman yok.
          </li>
        ) : (
          agendaDays.map((day) => {
            const key = toDateKey(day);
            const dayAssignments = byDate.get(key) ?? [];
            const isDone = completed.has(key);
            const hasWork = dayAssignments.length > 0;
            const today = isToday(day);
            const weekday = WEEKDAY_LABELS[(day.getDay() + 6) % 7];

            return (
              <li key={key}>
                <Link
                  href={`/antrenman/${key}`}
                  aria-current={today ? "date" : undefined}
                  className={cn(
                    "flex min-h-[56px] items-center gap-3 rounded-lg border p-3 transition-colors duration-[var(--dur-fast)] ease-soft active:bg-surface",
                    isDone
                      ? "border-primary/25 bg-primary/[0.06]"
                      : "border-paper-border bg-card",
                    today && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-11 shrink-0 flex-col items-center justify-center rounded-md",
                      today ? "bg-primary text-primary-foreground" : "bg-surface text-foreground",
                    )}
                  >
                    <span className="text-[10px] font-medium uppercase leading-none opacity-80">
                      {weekday}
                    </span>
                    <span className="text-base font-semibold tabular-nums leading-tight">
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    {hasWork ? (
                      <div className="space-y-0.5">
                        {dayAssignments.map((a) => (
                          <div key={a.id} className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: workoutColor(a.workout?.name) }}
                            />
                            <span className="truncate text-sm font-medium">
                              {a.workout?.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {isDone ? "Serbest antrenman" : "Plan yok"}
                      </span>
                    )}
                  </div>

                  {isDone ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/** Compact key for the day-cell states (desktop). */
function CalendarLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: workoutColor("a") }} />
        <span className="text-caption">Planlı</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-2" strokeWidth={3} />
        </span>
        <span className="text-caption">Tamamlandı</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3.5 rounded-full ring-2 ring-primary ring-offset-1 ring-offset-background" />
        <span className="text-caption">Bugün</span>
      </span>
    </div>
  );
}
