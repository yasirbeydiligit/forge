/**
 * Shared types for the live workout session player.
 *
 * The client runs an optimistic, localStorage-backed session and syncs set
 * mutations to JSON server actions in the background. Only *completed* sets are
 * ever stored or synced — an in-progress input row lives in component state.
 */

/** Per-exercise training targets, copied from the program (workout_exercises). */
export type ExerciseTarget = {
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  weight: number | null;
  rir: number | null;
  restSeconds: number | null;
};

/** The historical-context block (estimated 1RM, PR, recent sessions, trend). */
export type ExerciseStatsLite = {
  bestEst1RM: number | null;
  allTimePr: number | null;
  prevSessionWeights: number[];
};

/** A completed, logged set held in client state. */
export type SetEntry = {
  /** Client-generated id, stable across reconcile (used as React key + queue key). */
  localId: string;
  /** Server row id, filled once the logSet mutation has synced. */
  serverId: string | null;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  note: string | null;
  /** ms epoch when the set was marked complete. */
  completedAt: number;
  /** True when this set beat the all-time weight PR or estimated-1RM at completion. */
  pr: boolean;
};

export type ExerciseState = {
  workoutExerciseId: string;
  exerciseId: string;
  sets: SetEntry[];
};

export type RestState = {
  exerciseIndex: number;
  /** ms epoch when the rest countdown ends. */
  endsAt: number;
};

export type SessionState = {
  /** Schema version of the persisted shape; bump to invalidate stale local state. */
  version: number;
  date: string;
  assignmentId: string;
  workoutId: string;
  /** Server session id, set once the session has been started. */
  sessionId: string | null;
  /** ms epoch of session start; null until started. */
  startedAt: number | null;
  /** ms epoch of session finish; null until finished. */
  finishedAt: number | null;
  activeExerciseIndex: number;
  exercises: ExerciseState[];
  rest: RestState | null;
};

export const SESSION_STATE_VERSION = 1;
