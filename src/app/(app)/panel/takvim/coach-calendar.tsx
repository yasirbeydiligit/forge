"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isSameMonth, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createCalendarAssignment,
  deleteCalendarAssignment,
  type FormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildMonthMatrix, parseMonthKey } from "@/lib/calendar";
import { toDateKey, WEEKDAY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { workoutColor } from "@/lib/workout-color";

export type CalendarAssignmentView = {
  id: string;
  scheduled_date: string;
  athlete_id: string | null;
  program: { name: string } | null;
  workout: { name: string } | null;
  athlete: { full_name: string } | null;
};

type ProgramOption = {
  id: string;
  name: string;
  workouts: { id: string; name: string }[];
};

type AthleteOption = { id: string; full_name: string };

export function CoachCalendar({
  monthKey,
  monthLabel,
  prevKey,
  nextKey,
  assignments,
  programs,
  athletes,
}: {
  monthKey: string;
  monthLabel: string;
  prevKey: string;
  nextKey: string;
  assignments: CalendarAssignmentView[];
  programs: ProgramOption[];
  athletes: AthleteOption[];
}) {
  const month = useMemo(() => parseMonthKey(monthKey), [monthKey]);
  const weeks = useMemo(() => buildMonthMatrix(month), [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarAssignmentView[]>();
    for (const a of assignments) {
      if (!map.has(a.scheduled_date)) map.set(a.scheduled_date, []);
      map.get(a.scheduled_date)!.push(a);
    }
    return map;
  }, [assignments]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-h2 capitalize text-lab-ink">{monthLabel}</h2>
        <div className="flex gap-1.5">
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <Link href={`/panel/takvim?month=${prevKey}`} aria-label="Önceki ay">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="rounded-full">
            <Link href={`/panel/takvim?month=${nextKey}`} aria-label="Sonraki ay">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-label pb-1 text-center text-muted-foreground">
            {d}
          </div>
        ))}

        {weeks.flat().map((day) => {
          const key = toDateKey(day);
          const inMonth = isSameMonth(day, month);
          const dayAssignments = byDate.get(key) ?? [];
          const hasWork = dayAssignments.length > 0;
          const today = isToday(day);
          const stripe = hasWork ? workoutColor(dayAssignments[0].workout?.name) : null;

          return (
            <div
              key={key}
              aria-current={today ? "date" : undefined}
              className={cn(
                "group relative flex min-h-24 flex-col overflow-hidden rounded-lg border p-2 transition-[box-shadow,background-color] duration-[var(--dur-base)] ease-soft sm:min-h-28",
                !inMonth && "border-transparent bg-transparent opacity-40",
                inMonth && !hasWork && "border-paper-border bg-card",
                inMonth && hasWork && "border-paper-border bg-surface hover:shadow-raised",
                today && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              {stripe ? (
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
                <button
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className="text-muted-foreground opacity-0 transition-opacity duration-[var(--dur-fast)] hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Antrenman ata"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <div className="mt-1.5 space-y-1">
                {dayAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-1.5 text-[11px] leading-tight"
                  >
                    <span
                      aria-hidden
                      className="mt-1 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: workoutColor(a.workout?.name) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground/85">
                        {a.workout?.name}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {a.athlete ? a.athlete.full_name : a.program?.name}
                      </p>
                    </div>
                    <form action={deleteCalendarAssignment}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Atamayı kaldır"
                      >
                        <X className="size-3" />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <AssignDialog
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
        programs={programs}
        athletes={athletes}
      />
    </div>
  );
}

function AssignDialog({
  date,
  onClose,
  programs,
  athletes,
}: {
  date: string | null;
  onClose: () => void;
  programs: ProgramOption[];
  athletes: AthleteOption[];
}) {
  const [programId, setProgramId] = useState("");
  const [workoutId, setWorkoutId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    createCalendarAssignment,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Antrenman takvime eklendi.");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Reset selections whenever a new day is opened.
  useEffect(() => {
    setProgramId("");
    setWorkoutId("");
    setAthleteId("");
  }, [date]);

  const workouts =
    programs.find((p) => p.id === programId)?.workouts ?? [];

  return (
    <Dialog open={date !== null} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Antrenman ata</DialogTitle>
          <DialogDescription>{date}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="scheduledDate" value={date ?? ""} />
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="workoutId" value={workoutId} />
          <input type="hidden" name="athleteId" value={athleteId} />

          <div className="space-y-2">
            <Label>Program</Label>
            <Select
              value={programId}
              onValueChange={(v) => {
                setProgramId(v);
                setWorkoutId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Program seç" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Antrenman günü</Label>
            <Select
              value={workoutId}
              onValueChange={setWorkoutId}
              disabled={!programId}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    programId ? "Antrenman seç" : "Önce program seç"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {workouts.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kime?</Label>
            <Select
              value={athleteId || "all"}
              onValueChange={(v) => setAthleteId(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Tüm sporcular (program geneli)
                </SelectItem>
                {athletes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Program geneli atamalar, o programa kayıtlı tüm sporcuların
              takviminde görünür.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending || !programId || !workoutId}
            >
              {isPending ? "Ekleniyor…" : "Takvime ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
