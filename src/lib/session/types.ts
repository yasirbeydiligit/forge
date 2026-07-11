/**
 * Shared types for the live workout session player.
 *
 * The client runs an optimistic, localStorage-backed session and syncs set
 * mutations to JSON server actions in the background. Only *completed* sets are
 * ever stored or synced — an in-progress input row lives in component state.
 */

import type { PRSet, PRType } from "@/lib/pr/evaluate-pr";

/** Per-exercise training targets, copied from the program (workout_exercises). */
export type ExerciseTarget = {
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  weight: number | null;
  rir: number | null;
  restSeconds: number | null;
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
  /** True when evaluatePR flagged this set as a PR at completion (observed). */
  pr: boolean;
  /**
   * Which PR rule fired (weight/reps/both/tradeoff/rir) for celebration copy.
   * Optional so state persisted before this field existed still hydrates.
   */
  prType?: PRType | null;
};

/**
 * The minimal history a substituted (muadil) exercise needs so the last-session
 * strip and live PR detection keep working after the swap — persisted with the
 * session so a refresh doesn't lose it.
 */
export type SubstituteStats = {
  allTimePr: number | null;
  prevSessionWeights: number[];
  prevSessionSets: { weight: number; reps: number | null }[];
  prHistory: PRSet[];
};

/**
 * A session-scoped muadil swap. The program row (workout_exercises) is NOT
 * mutated — athletes can't write coach-owned programs under RLS — so the swap
 * lives here: sets log under the substitute's exercise id while
 * workout_exercise_id keeps pointing at the original row (targets survive).
 */
export type SubstituteInfo = {
  /** The program's original exercise id (first one, across repeated swaps). */
  originalExerciseId: string;
  name: string;
  category: string | null;
  stats: SubstituteStats;
};

/**
 * An exercise the athlete added mid-session (not in the program). Like the
 * muadil swap it is session-scoped: the program is never mutated and sets log
 * with workout_exercise_id = null. Everything the player needs to render and
 * PR-check it lives here, since there is no program row to read from.
 */
export type AddedExerciseInfo = {
  name: string;
  category: string | null;
  /** Session-local target (the athlete picks the set count when adding). */
  target: ExerciseTarget;
  stats: SubstituteStats;
};

export type ExerciseState = {
  /** Program row id; a client-generated "local-…" key for added exercises. */
  workoutExerciseId: string;
  /** Exercise the sets log under; differs from the program's after a muadil swap. */
  exerciseId: string;
  sets: SetEntry[];
  /** Present (non-null) only while a muadil swap is active. */
  substitute?: SubstituteInfo | null;
  /** Present (non-null) only on exercises added during this session. */
  added?: AddedExerciseInfo | null;
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
