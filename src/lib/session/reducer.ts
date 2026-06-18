import type { ExerciseState, SessionState, SetEntry } from "./types";
import { SESSION_STATE_VERSION } from "./types";

export type ServerSet = {
  id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  note: string | null;
  completedAt: number;
};

export type InitInput = {
  date: string;
  assignmentId: string;
  workoutId: string;
  sessionId: string | null;
  startedAt: number | null;
  exercises: {
    workoutExerciseId: string;
    exerciseId: string;
    serverSets: ServerSet[];
  }[];
};

export type SessionAction =
  | { type: "START"; sessionId: string; startedAt: number }
  | { type: "COMPLETE_SET"; exerciseIndex: number; set: SetEntry }
  | { type: "RECONCILE_SET"; localId: string; serverId: string }
  | { type: "DELETE_SET"; localId: string }
  | { type: "SET_ACTIVE_EXERCISE"; index: number }
  | { type: "START_REST"; exerciseIndex: number; endsAt: number }
  | { type: "CLEAR_REST" }
  | { type: "FINISH"; finishedAt: number }
  | { type: "REOPEN" };

function serverSetToEntry(s: ServerSet): SetEntry {
  return {
    localId: `srv-${s.id}`,
    serverId: s.id,
    weight: s.weight,
    reps: s.reps,
    rpe: s.rpe,
    note: s.note,
    completedAt: s.completedAt,
    pr: false,
  };
}

/** Resume cursor: first exercise with no sets, else the last exercise. */
function resumeCursor(exercises: ExerciseState[]): number {
  if (exercises.length === 0) return 0;
  const firstEmpty = exercises.findIndex((e) => e.sets.length === 0);
  return firstEmpty === -1 ? exercises.length - 1 : firstEmpty;
}

export function createInitialState(input: InitInput): SessionState {
  const exercises: ExerciseState[] = input.exercises.map((e) => ({
    workoutExerciseId: e.workoutExerciseId,
    exerciseId: e.exerciseId,
    sets: e.serverSets.map(serverSetToEntry),
  }));

  return {
    version: SESSION_STATE_VERSION,
    date: input.date,
    assignmentId: input.assignmentId,
    workoutId: input.workoutId,
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    finishedAt: null,
    activeExerciseIndex: resumeCursor(exercises),
    exercises,
    rest: null,
  };
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

/** Apply `fn` to the exercise at `index`, returning a new exercises array. */
function updateExercise(
  exercises: ExerciseState[],
  index: number,
  fn: (e: ExerciseState) => ExerciseState,
): ExerciseState[] {
  return exercises.map((e, i) => (i === index ? fn(e) : e));
}

/** Apply `fn` to whichever set has `localId`, across all exercises. */
function updateSetEverywhere(
  exercises: ExerciseState[],
  localId: string,
  fn: (s: SetEntry) => SetEntry,
): ExerciseState[] {
  return exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => (s.localId === localId ? fn(s) : s)),
  }));
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "START":
      return { ...state, sessionId: action.sessionId, startedAt: action.startedAt };

    case "COMPLETE_SET":
      return {
        ...state,
        exercises: updateExercise(state.exercises, action.exerciseIndex, (e) => ({
          ...e,
          sets: [...e.sets, action.set],
        })),
      };

    case "RECONCILE_SET":
      return {
        ...state,
        exercises: updateSetEverywhere(state.exercises, action.localId, (s) => ({
          ...s,
          serverId: action.serverId,
        })),
      };

    case "DELETE_SET":
      return {
        ...state,
        exercises: state.exercises.map((e) => ({
          ...e,
          sets: e.sets.filter((s) => s.localId !== action.localId),
        })),
      };

    case "SET_ACTIVE_EXERCISE":
      return {
        ...state,
        activeExerciseIndex: clampIndex(action.index, state.exercises.length),
      };

    case "START_REST":
      return {
        ...state,
        rest: { exerciseIndex: action.exerciseIndex, endsAt: action.endsAt },
      };

    case "CLEAR_REST":
      return { ...state, rest: null };

    case "FINISH":
      return { ...state, finishedAt: action.finishedAt };

    case "REOPEN":
      return { ...state, finishedAt: null };

    default:
      return state;
  }
}

/**
 * Merge durable server state with locally-persisted state on resume. Server
 * sets are the source of truth for *what was logged*; local state restores
 * *where you were* (cursor, rest, start time) plus any not-yet-synced sets.
 */
export function hydrate(input: {
  server: SessionState;
  persisted: SessionState | null;
}): SessionState {
  const { server, persisted } = input;
  if (!persisted) return server;

  const persistedByWe = new Map(
    persisted.exercises.map((e) => [e.workoutExerciseId, e]),
  );

  const exercises: ExerciseState[] = server.exercises.map((srvEx) => {
    const local = persistedByWe.get(srvEx.workoutExerciseId);
    if (!local) return srvEx;
    // Keep every server (synced) set, then append local sets that have not
    // been synced yet (serverId === null) so offline-queued work survives.
    const pending = local.sets.filter((s) => s.serverId === null);
    const sets = [...srvEx.sets, ...pending].sort(
      (a, b) => a.completedAt - b.completedAt,
    );
    return { ...srvEx, sets };
  });

  return {
    ...server,
    exercises,
    sessionId: persisted.sessionId ?? server.sessionId,
    startedAt: persisted.startedAt ?? server.startedAt,
    finishedAt: persisted.finishedAt,
    activeExerciseIndex: clampIndex(persisted.activeExerciseIndex, exercises.length),
    rest: persisted.rest,
  };
}
