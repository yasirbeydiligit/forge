import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  addWorkoutExercise,
  createWorkout,
  deleteProgram,
  deleteWorkout,
  deleteWorkoutExercise,
  moveWorkoutExercise,
  updateProgram,
  updateWorkout,
  updateWorkoutExercise,
} from "../actions";
import { AssignCalendarDialog } from "../assign-calendar-dialog";
import { ProgramDetail } from "@/components/programs/program-detail";
import type { ProgramDetailActions } from "@/components/programs/types";
import { requireProfile } from "@/lib/auth";
import { suggestAlternatives } from "@/lib/exercises/alternatives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise, Program, WorkoutWithExercises } from "@/lib/types";

export const metadata: Metadata = { title: "Programım" };

export default async function MyProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const profile = await requireProfile();
  const { programId } = await params;
  const supabase = await createSupabaseServerClient();

  // Only the athlete's own program — not a community program they happened to
  // open under this path.
  const { data: program } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("created_by", profile.id)
    .maybeSingle();
  if (!program) notFound();

  const [{ data: workoutsData }, { data: exercisesData }] = await Promise.all([
    supabase
      .from("workouts")
      .select("*, workout_exercises(*, exercise:exercises(*))")
      .eq("program_id", programId)
      .order("order_index", { ascending: true })
      .order("order_index", {
        ascending: true,
        referencedTable: "workout_exercises",
      }),
    // RLS returns exactly system + the athlete's own exercises.
    supabase.from("exercises").select("*").order("name", { ascending: true }),
  ]);

  const workouts = (workoutsData ?? []) as WorkoutWithExercises[];

  const actions: ProgramDetailActions = {
    updateProgram,
    deleteProgram,
    createWorkout,
    updateWorkout,
    deleteWorkout,
    addWorkoutExercise,
    updateWorkoutExercise,
    deleteWorkoutExercise,
    moveWorkoutExercise,
    suggestAlternatives,
  };

  return (
    <ProgramDetail
      program={program as Program}
      workouts={workouts}
      exercises={(exercisesData ?? []) as Exercise[]}
      actions={actions}
      basePath="/programlarim"
      backLabel="Programlarım"
      exerciseLibraryHref="/egzersizlerim"
      headerActions={
        <AssignCalendarDialog
          programId={programId}
          workouts={workouts.map((w) => ({ id: w.id, name: w.name }))}
        />
      }
    />
  );
}
