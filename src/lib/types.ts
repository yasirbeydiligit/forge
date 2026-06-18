import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type Invite = Tables<"invites">;
export type Exercise = Tables<"exercises">;
export type Program = Tables<"programs">;
export type Workout = Tables<"workouts">;
export type WorkoutExercise = Tables<"workout_exercises">;
export type Enrollment = Tables<"enrollments">;
export type CalendarAssignment = Tables<"calendar_assignments">;
export type LogSession = Tables<"log_sessions">;
export type LogSet = Tables<"log_sets">;
export type FeedPost = Tables<"feed_posts">;
export type FeedComment = Tables<"feed_comments">;
export type FeedLike = Tables<"feed_likes">;
export type DailyMetric = Tables<"daily_metrics">;
export type NutritionTarget = Tables<"nutrition_targets">;
export type Meal = Tables<"meals">;

/** A workout_exercise joined with its library exercise. */
export type WorkoutExerciseWithExercise = WorkoutExercise & {
  exercise: Exercise;
};

/** A workout with its ordered exercises. */
export type WorkoutWithExercises = Workout & {
  workout_exercises: WorkoutExerciseWithExercise[];
};
