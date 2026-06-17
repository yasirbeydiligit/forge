import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getISOWeek } from "date-fns";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";

import { AddSetForm } from "./add-set-form";
import {
  deleteLogSet,
  saveSessionNotes,
  toggleSessionComplete,
} from "../actions";
import {
  LabHeader,
  LabPage,
  MarginNote,
  PaperCard,
  SectionLabel,
} from "@/components/lab/lab";
import { InsightNotes } from "@/components/library/insight-note";
import { SessionTimer } from "@/components/logbook/session-timer";
import { Sparkline } from "@/components/logbook/sparkline";
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatNumber, formatRepRange, formatRest } from "@/lib/format";
import {
  computeExerciseStats,
  type ExerciseStats,
  type HistorySetRow,
} from "@/lib/logbook-stats";
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
  notes: string | null;
  created_at: string;
  log_sets: LogSet[];
};

const COLS = "grid grid-cols-[1.75rem_1fr_1fr_1fr_2rem] items-center gap-2";

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-2 text-center">
      <p className="font-mono text-[15px] tabular-nums text-paper-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-paper-muted">
        {label}
      </p>
    </div>
  );
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
  const exerciseIds = [
    ...new Set(
      assignments.flatMap(
        (a) => a.workout?.workout_exercises?.map((we) => we.exercise_id) ?? [],
      ),
    ),
  ];

  const [{ data: sessionsData }, { data: historyData }] = await Promise.all([
    assignmentIds.length
      ? supabase
          .from("log_sessions")
          .select("id, assignment_id, completed, notes, created_at, log_sets(*)")
          .eq("athlete_id", profile.id)
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] as DaySession[] }),
    exerciseIds.length
      ? supabase
          .from("log_sets")
          .select(
            "weight, reps, rpe, set_number, exercise_id, created_at, session:log_sessions(session_date)",
          )
          .in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [] }),
  ]);

  const sessions = (sessionsData ?? []) as unknown as DaySession[];

  // Flatten history rows and compute per-exercise stats.
  const historyRows = (
    (historyData ?? []) as unknown as (Omit<HistorySetRow, "session_date"> & {
      session: { session_date: string } | null;
    })[]
  )
    .filter((r) => r.session)
    .map((r) => ({ ...r, session_date: r.session!.session_date }));

  const statsByExercise = new Map<string, ExerciseStats>();
  for (const id of exerciseIds) {
    statsByExercise.set(
      id,
      computeExerciseStats(
        historyRows.filter((r) => r.exercise_id === id),
        date,
      ),
    );
  }

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
        subtitle={workoutNames || "Bugün için planlı antrenman yok"}
      />

      {assignments.length === 0 ? (
        <PaperCard className="p-5">
          <p className="font-serif text-lg italic text-paper-muted">
            Bu güne planlı antrenman yok.
          </p>
        </PaperCard>
      ) : (
        <div className="space-y-12">
          {assignments.map((assignment) => {
            const workout = assignment.workout;
            if (!workout) return null;
            const session = sessionByAssignment.get(assignment.id);
            const completed = session?.completed ?? false;

            const setsByExercise = new Map<string, LogSet[]>();
            for (const set of session?.log_sets ?? []) {
              if (!setsByExercise.has(set.exercise_id))
                setsByExercise.set(set.exercise_id, []);
              setsByExercise.get(set.exercise_id)!.push(set);
            }
            for (const list of setsByExercise.values())
              list.sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              );

            const totalVolume = (session?.log_sets ?? []).reduce(
              (sum, s) => sum + (Number(s.weight) || 0) * (s.reps || 0),
              0,
            );

            // Pick the exercise with the strongest positive trend for a note.
            let bestTrend: { name: string; delta: number } | null = null;
            for (const we of workout.workout_exercises) {
              const t = statsByExercise.get(we.exercise_id)?.trendDelta;
              if (t != null && t > 0 && (!bestTrend || t > bestTrend.delta)) {
                bestTrend = { name: we.exercise?.name ?? "Egzersiz", delta: t };
              }
            }

            return (
              <section key={assignment.id} className="space-y-8">
                <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <SectionLabel>{workout.name}</SectionLabel>
                    <div className="mt-1 flex items-center gap-3">
                      {session ? <SessionTimer startIso={session.created_at} /> : null}
                      {totalVolume > 0 ? (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {totalVolume.toLocaleString("tr-TR")} kg hacim
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <form action={toggleSessionComplete}>
                    <input type="hidden" name="date" value={date} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input type="hidden" name="workoutId" value={workout.id} />
                    <input
                      type="hidden"
                      name="completed"
                      value={completed ? "false" : "true"}
                    />
                    <SubmitButton
                      variant={completed ? "default" : "outline"}
                      size="sm"
                    >
                      <CheckCircle2 className="size-4" />
                      {completed ? "Tamamlandı" : "Tamamla"}
                    </SubmitButton>
                  </form>
                </div>

                {workout.workout_exercises.map((we) => {
                  const reps = formatRepRange(
                    we.target_reps_min,
                    we.target_reps_max,
                  );
                  const rest = formatRest(we.rest_seconds);
                  const loggedSets = setsByExercise.get(we.exercise_id) ?? [];
                  const stats = statsByExercise.get(we.exercise_id);
                  const hasHistory =
                    !!stats && stats.recentSessions.length > 0;

                  return (
                    <div key={we.id} className="space-y-3">
                      <div>
                        <h3 className="font-serif text-xl leading-tight text-lab-ink">
                          {we.exercise?.name ?? "Egzersiz"}
                        </h3>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                          {we.exercise?.category ? `${we.exercise.category} · ` : ""}
                          {we.target_sets ? `${we.target_sets} × ` : ""}
                          {reps ?? "—"}
                          {we.target_weight
                            ? ` @ ${formatNumber(we.target_weight)} kg`
                            : ""}
                          {we.target_rpe ? ` · RPE ${formatNumber(we.target_rpe)}` : ""}
                          {rest ? ` · ${rest}` : ""}
                        </p>
                      </div>

                      {we.notes ? (
                        <p className="text-xs italic text-muted-foreground">
                          {we.notes}
                        </p>
                      ) : null}

                      <div>
                        <div
                          className={`${COLS} pb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground`}
                        >
                          <span className="text-center">Set</span>
                          <span className="text-center">Kg</span>
                          <span className="text-center">Tekrar</span>
                          <span className="text-center">RPE</span>
                          <span />
                        </div>

                        {loggedSets.map((set, i) => {
                          const prev = stats?.prevSessionWeights[i];
                          const delta =
                            prev != null && set.weight != null
                              ? Math.round((Number(set.weight) - prev) * 10) / 10
                              : null;
                          return (
                            <div
                              key={set.id}
                              className={`${COLS} border-t border-border/40 py-1.5 text-sm`}
                            >
                              <span className="text-center font-mono text-xs text-muted-foreground">
                                {i + 1}
                              </span>
                              <span className="flex flex-col items-center leading-none">
                                <span className="font-mono tabular-nums text-foreground">
                                  {formatNumber(set.weight)}
                                </span>
                                {delta != null && delta !== 0 ? (
                                  <span
                                    className={`mt-0.5 font-mono text-[10px] ${
                                      delta > 0 ? "text-lab-green" : "text-lab-amber"
                                    }`}
                                  >
                                    {delta > 0 ? "+" : ""}
                                    {delta}
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-center font-mono tabular-nums text-foreground">
                                {set.reps ?? "—"}
                              </span>
                              <span className="text-center font-mono tabular-nums text-muted-foreground">
                                {set.rpe ? formatNumber(set.rpe) : "—"}
                              </span>
                              <form
                                action={deleteLogSet}
                                className="justify-self-center"
                              >
                                <input type="hidden" name="id" value={set.id} />
                                <input type="hidden" name="date" value={date} />
                                <button
                                  type="submit"
                                  className="text-muted-foreground transition-colors hover:text-destructive"
                                  aria-label="Seti sil"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </form>
                            </div>
                          );
                        })}

                        <AddSetForm
                          date={date}
                          assignmentId={assignment.id}
                          workoutId={workout.id}
                          exerciseId={we.exercise_id}
                          workoutExerciseId={we.id}
                          nextSetNumber={loggedSets.length + 1}
                          restSeconds={we.rest_seconds}
                          weightPlaceholder={
                            we.target_weight
                              ? formatNumber(we.target_weight)
                              : undefined
                          }
                          repsPlaceholder={
                            we.target_reps_min
                              ? String(we.target_reps_min)
                              : undefined
                          }
                        />
                      </div>

                      {hasHistory && stats ? (
                        <PaperCard className="p-3">
                          <div className="grid grid-cols-4 divide-x divide-paper-border">
                            <StatCell
                              label="tah. 1RM"
                              value={
                                stats.bestEst1RM != null
                                  ? `${stats.bestEst1RM}`
                                  : "—"
                              }
                            />
                            <StatCell
                              label="PR kg"
                              value={
                                stats.allTimePr != null ? `${stats.allTimePr}` : "—"
                              }
                            />
                            <StatCell
                              label="hacim·4h"
                              value={stats.volume4w.toLocaleString("tr-TR")}
                            />
                            <StatCell
                              label="RPE·4h"
                              value={stats.avgRpe4w ?? "—"}
                            />
                          </div>

                          <div className="mt-3 flex items-start justify-between gap-3 border-t border-paper-border pt-3">
                            <div className="min-w-0">
                              <p className="mb-1 text-[10px] uppercase tracking-wider text-paper-muted">
                                Son seanslar
                              </p>
                              <ul className="space-y-0.5 font-mono text-xs text-paper-foreground">
                                {stats.recentSessions.slice(0, 3).map((s) => (
                                  <li
                                    key={s.date}
                                    className="flex justify-between gap-3"
                                  >
                                    <span className="text-paper-muted">
                                      {formatDate(s.date, "d MMM")}
                                    </span>
                                    <span className="tabular-nums">{s.scheme}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="shrink-0 text-right">
                              <Sparkline points={stats.trendPoints} />
                              {stats.trendDelta != null ? (
                                <p
                                  className={`mt-1 font-mono text-xs tabular-nums ${
                                    stats.trendDelta >= 0
                                      ? "text-lab-green"
                                      : "text-lab-amber"
                                  }`}
                                >
                                  {stats.trendDelta >= 0 ? "+" : ""}
                                  {stats.trendDelta} kg · 28g
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </PaperCard>
                      ) : null}
                    </div>
                  );
                })}

                {bestTrend ? (
                  <MarginNote label="Not · Yüklenme ilerleyişi" accent="green">
                    {bestTrend.name} son 4 haftada{" "}
                    <span className="not-italic">+{bestTrend.delta} kg</span> ilerledi
                    — istikrarlı bir artış. Yüklenmeyi kontrollü artırmaya devam et;
                    tempo ve teknik bozulmadığı sürece bu tempo sürdürülebilir.
                  </MarginNote>
                ) : null}

                <form action={saveSessionNotes} className="space-y-2 pt-2">
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <input type="hidden" name="workoutId" value={workout.id} />
                  <SectionLabel>Seans notu</SectionLabel>
                  <Textarea
                    name="notes"
                    defaultValue={session?.notes ?? ""}
                    placeholder="Nasıl geçti? Ağrı, his, tempo…"
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <SubmitButton variant="outline" size="sm">
                      Notu kaydet
                    </SubmitButton>
                  </div>
                </form>
              </section>
            );
          })}

          <InsightNotes insights={insights} className="space-y-3" />
        </div>
      )}
    </LabPage>
  );
}
