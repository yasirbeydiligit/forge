import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getISOWeek } from "date-fns";
import { ArrowLeft, ArrowRight, CheckCircle2, Play, RotateCcw } from "lucide-react";

import { LabHeader, LabPage, PaperCard } from "@/components/lab/lab";
import { InsightNotes } from "@/components/library/insight-note";
import { SessionTimer } from "@/components/logbook/session-timer";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatNumber, formatRepRange } from "@/lib/format";
import { getAthleteInsights } from "@/lib/rag/insights-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise, LogSet, WorkoutExercise } from "@/lib/types";

export const metadata: Metadata = { title: "Antrenman" };

type DayWorkoutExercise = WorkoutExercise & { exercise: Exercise | null };
type DayAssignment = {
  id: string;
  workout: {
    id: string;
    name: string;
    notes: string | null;
    workout_exercises: DayWorkoutExercise[];
  } | null;
};
type DaySession = {
  id: string;
  assignment_id: string | null;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  log_sets: LogSet[];
};

/** Compact duration like "1 sa 37 dk" / "42 dk". */
function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
}

export default async function WorkoutDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const profile = await requireProfile();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: assignmentsData } = await supabase
    .from("calendar_assignments")
    .select(
      "id, workout:workouts(id, name, notes, workout_exercises(*, exercise:exercises(*)))",
    )
    .eq("scheduled_date", date);

  const assignments = (assignmentsData ?? []) as unknown as DayAssignment[];
  for (const a of assignments) {
    a.workout?.workout_exercises?.sort((x, y) => x.order_index - y.order_index);
  }

  const assignmentIds = assignments.map((a) => a.id);
  const { data: sessionsData } = assignmentIds.length
    ? await supabase
        .from("log_sessions")
        .select("id, assignment_id, completed, completed_at, notes, created_at, log_sets(*)")
        .eq("athlete_id", profile.id)
        .in("assignment_id", assignmentIds)
    : { data: [] as DaySession[] };

  const sessions = (sessionsData ?? []) as unknown as DaySession[];
  const sessionByAssignment = new Map<string, DaySession>();
  for (const s of sessions) {
    if (s.assignment_id) sessionByAssignment.set(s.assignment_id, s);
  }

  const insights = await getAthleteInsights(supabase, profile.id, "training");

  const workoutNames = assignments
    .map((a) => a.workout?.name)
    .filter(Boolean)
    .join(" · ");

  return (
    <LabPage>
      <Link
        href="/takvim"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Takvim
      </Link>

      <LabHeader
        metaLeft={formatDate(date, "EEEE")}
        metaRight={`Hafta ${getISOWeek(new Date(date))}`}
        title={formatDate(date, "d MMMM yyyy")}
        subtitle={
          workoutNames ? (
            <span className="font-semibold not-italic text-foreground">{workoutNames}</span>
          ) : (
            "Bugün için planlı antrenman yok"
          )
        }
      />

      {assignments.length === 0 ? (
        <PaperCard className="p-5">
          <p className="font-serif text-lg italic text-paper-muted">
            Bu güne planlı antrenman yok.
          </p>
        </PaperCard>
      ) : (
        <div className="space-y-6">
          {assignments.map((assignment) => {
            const workout = assignment.workout;
            if (!workout) return null;
            const session = sessionByAssignment.get(assignment.id);
            const loggedSets = session?.log_sets ?? [];
            const completed = session?.completed ?? false;
            const inProgress = !completed && loggedSets.length > 0;

            const plannedSets = workout.workout_exercises.reduce(
              (sum, we) => sum + (we.target_sets ?? 0),
              0,
            );
            const setsByExercise = new Map<string, number>();
            for (const s of loggedSets) {
              setsByExercise.set(
                s.exercise_id,
                (setsByExercise.get(s.exercise_id) ?? 0) + 1,
              );
            }

            const durationMs =
              completed && session?.completed_at
                ? new Date(session.completed_at).getTime() -
                  new Date(session.created_at).getTime()
                : null;

            const href = `/antrenman/${date}/seans?a=${assignment.id}`;
            const cta = completed
              ? { label: "Antrenmana dön", Icon: RotateCcw }
              : inProgress
                ? { label: "Devam et", Icon: ArrowRight }
                : { label: "Antrenmanı başlat", Icon: Play };

            return (
              <PaperCard key={assignment.id} className="overflow-hidden">
                <div className="border-b border-paper-border p-5">
                  <h2 className="font-serif text-2xl font-semibold leading-tight text-lab-ink">
                    {workout.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {completed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-lab-green">
                        <CheckCircle2 className="size-3.5" /> Tamamlandı
                      </span>
                    ) : inProgress && session ? (
                      <SessionTimer startIso={session.created_at} />
                    ) : (
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-paper-muted">
                        Başlanmadı
                      </span>
                    )}
                    {loggedSets.length > 0 ? (
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {loggedSets.length}/{plannedSets || "—"} set
                      </span>
                    ) : null}
                    {durationMs != null ? (
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatDuration(durationMs)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <ul className="divide-y divide-paper-border">
                  {workout.workout_exercises.map((we) => {
                    const reps = formatRepRange(we.target_reps_min, we.target_reps_max);
                    const done = setsByExercise.get(we.exercise_id) ?? 0;
                    const target = we.target_sets ?? 0;
                    return (
                      <li
                        key={we.id}
                        className="flex items-center justify-between gap-3 px-5 py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-serif text-base font-semibold text-paper-foreground">
                            {we.exercise?.name ?? "Egzersiz"}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-paper-muted">
                            {we.target_sets ? `${we.target_sets} × ` : ""}
                            {reps ?? "—"}
                            {we.target_weight ? ` @ ${formatNumber(we.target_weight)} kg` : ""}
                          </p>
                        </div>
                        <span
                          className={
                            target > 0 && done >= target
                              ? "shrink-0 font-mono text-sm tabular-nums text-lab-green"
                              : "shrink-0 font-mono text-sm tabular-nums text-paper-muted"
                          }
                        >
                          {done}/{target || "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="p-4 pt-3">
                  <Link
                    href={href}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-raised transition-transform duration-[var(--dur-fast)] ease-soft active:scale-[0.98]"
                  >
                    <cta.Icon className="size-4" /> {cta.label}
                  </Link>
                </div>
              </PaperCard>
            );
          })}

          <InsightNotes insights={insights} className="space-y-3" />
        </div>
      )}
    </LabPage>
  );
}
