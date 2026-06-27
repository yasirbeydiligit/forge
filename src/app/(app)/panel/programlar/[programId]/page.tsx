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
import { ProgramDetail } from "@/components/programs/program-detail";
import type { ProgramDetailActions } from "@/components/programs/types";
import { requireCoach } from "@/lib/auth";
import { suggestAlternatives } from "@/lib/exercises/alternatives";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise, Program, WorkoutWithExercises } from "@/lib/types";

export const metadata: Metadata = { title: "Program" };

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const coach = await requireCoach();
  const { programId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: program } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
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
    supabase
      .from("exercises")
      .select("*")
      .or(`is_system.eq.true,created_by.eq.${coach.id}`)
      .order("category", { ascending: true, nullsFirst: false })
      .order("region", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
  ]);

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
      workouts={(workoutsData ?? []) as WorkoutWithExercises[]}
      exercises={(exercisesData ?? []) as Exercise[]}
      actions={actions}
      basePath="/panel/programlar"
      exerciseLibraryHref="/panel/egzersizler"
      showPublish
      showDraftBadge
    />
  );
}
