import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { computeExerciseStats, type HistorySetRow } from "@/lib/logbook-stats";
import { getAthleteInsights } from "@/lib/rag/insights-server";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise, LogSet, WorkoutExercise } from "@/lib/types";

import { SessionPlayer } from "./session-player";
import type { PlayerData, PlayerExercise } from "./player-data";

export const metadata: Metadata = { title: "Seans" };

type DayWorkoutExercise = WorkoutExercise & { exercise: Exercise | null };
type Assignment = {
  id: string;
  scheduled_date: string;
  workout: {
    id: string;
    name: string;
    notes: string | null;
    workout_exercises: DayWorkoutExercise[];
  } | null;
};
type Session = {
  id: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
  log_sets: LogSet[];
};

export default async function SessionPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const profile = await requireProfile();
  const { date } = await params;
  const { a: assignmentId } = await searchParams;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  if (!assignmentId) redirect(`/antrenman/${date}`);

  const supabase = await createSupabaseServerClient();
  const { data: assignmentData } = await supabase
    .from("calendar_assignments")
    .select(
      "id, scheduled_date, workout:workouts(id, name, notes, workout_exercises(*, exercise:exercises(*)))",
    )
    .eq("id", assignmentId)
    .maybeSingle();

  const assignment = assignmentData as unknown as Assignment | null;
  const workout = assignment?.workout;
  if (!assignment || !workout) redirect(`/antrenman/${date}`);

  workout.workout_exercises.sort((x, y) => x.order_index - y.order_index);
  const exerciseIds = [
    ...new Set(workout.workout_exercises.map((we) => we.exercise_id)),
  ];

  const [{ data: sessionData }, { data: historyData }, insights] = await Promise.all([
    supabase
      .from("log_sessions")
      .select("id, completed, notes, created_at, log_sets(*)")
      .eq("athlete_id", profile.id)
      .eq("assignment_id", assignment.id)
      .maybeSingle(),
    exerciseIds.length
      ? supabase
          .from("log_sets")
          .select(
            "weight, reps, rpe, set_number, exercise_id, created_at, session:log_sessions(session_date)",
          )
          .in("exercise_id", exerciseIds)
      : Promise.resolve({ data: [] }),
    getAthleteInsights(supabase, profile.id, "training"),
  ]);

  const session = sessionData as unknown as Session | null;

  // Per-exercise historical stats (relative to the day being trained).
  const historyRows = (
    (historyData ?? []) as unknown as (Omit<HistorySetRow, "session_date"> & {
      session: { session_date: string } | null;
    })[]
  )
    .filter((r) => r.session)
    .map((r) => ({ ...r, session_date: r.session!.session_date }));

  // Already-logged sets for this session, grouped by exercise (for resume).
  const setsByExercise = new Map<string, LogSet[]>();
  for (const s of session?.log_sets ?? []) {
    if (!setsByExercise.has(s.exercise_id)) setsByExercise.set(s.exercise_id, []);
    setsByExercise.get(s.exercise_id)!.push(s);
  }
  for (const list of setsByExercise.values()) {
    list.sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());
  }

  const exercises: PlayerExercise[] = workout.workout_exercises.map((we) => {
    const stats = computeExerciseStats(
      historyRows.filter((r) => r.exercise_id === we.exercise_id),
      date,
    );
    const logged = setsByExercise.get(we.exercise_id) ?? [];
    return {
      workoutExerciseId: we.id,
      exerciseId: we.exercise_id,
      name: we.exercise?.name ?? "Egzersiz",
      category: we.exercise?.category ?? null,
      notes: we.notes,
      target: {
        sets: we.target_sets,
        repsMin: we.target_reps_min,
        repsMax: we.target_reps_max,
        weight: we.target_weight != null ? Number(we.target_weight) : null,
        rpe: we.target_rpe != null ? Number(we.target_rpe) : null,
        restSeconds: we.rest_seconds,
      },
      stats: {
        bestEst1RM: stats.bestEst1RM,
        allTimePr: stats.allTimePr,
        allTimePrDate: stats.allTimePrDate,
        prevSessionWeights: stats.prevSessionWeights,
        volume4w: stats.volume4w,
        avgRpe4w: stats.avgRpe4w,
        recentSessions: stats.recentSessions.map((s) => ({ date: s.date, scheme: s.scheme })),
        trendPoints: stats.trendPoints,
        trendDelta: stats.trendDelta,
      },
      serverSets: logged.map((s) => ({
        id: s.id,
        weight: s.weight != null ? Number(s.weight) : null,
        reps: s.reps,
        rpe: s.rpe != null ? Number(s.rpe) : null,
        note: s.notes,
        completedAt: new Date(s.created_at).getTime(),
      })),
    };
  });

  const data: PlayerData = {
    date,
    assignmentId: assignment.id,
    workoutId: workout.id,
    workoutName: workout.name,
    startedAtMs: session ? new Date(session.created_at).getTime() : null,
    completed: session?.completed ?? false,
    initialNote: session?.notes ?? "",
    exercises,
    insights,
  };

  return <SessionPlayer data={data} />;
}
