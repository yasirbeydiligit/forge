import type {
  ExerciseState,
  ExerciseTarget,
  SessionState,
  SetEntry,
  SubstituteStats,
} from "./types";
import { SESSION_STATE_VERSION } from "./types";

export type ServerSet = {
  id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
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

export type SubstituteInput = {
  exerciseId: string;
  name: string;
  category: string | null;
  stats: SubstituteStats;
};

export type AddedExerciseInput = {
  /** Client-generated stable key; becomes workoutExerciseId locally, never sent to the server. */
  localKey: string;
  exerciseId: string;
  name: string;
  category: string | null;
  target: ExerciseTarget;
  stats: SubstituteStats;
};

export type SessionAction =
  | { type: "START"; sessionId: string; startedAt: number }
  | { type: "SUBSTITUTE_EXERCISE"; exerciseIndex: number; substitute: SubstituteInput }
  | { type: "ADD_EXERCISE"; exercise: AddedExerciseInput }
  | { type: "REMOVE_EXERCISE"; exerciseIndex: number }
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
    rir: s.rir,
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

    case "SUBSTITUTE_EXERCISE":
      return {
        ...state,
        exercises: updateExercise(state.exercises, action.exerciseIndex, (e) => {
          const originalExerciseId = e.substitute?.originalExerciseId ?? e.exerciseId;
          // Swapping back to the program's exercise cancels the substitution.
          if (action.substitute.exerciseId === originalExerciseId) {
            return { ...e, exerciseId: originalExerciseId, substitute: null };
          }
          return {
            ...e,
            exerciseId: action.substitute.exerciseId,
            substitute: {
              originalExerciseId,
              name: action.substitute.name,
              category: action.substitute.category,
              stats: action.substitute.stats,
            },
          };
        }),
      };

    case "ADD_EXERCISE":
      return {
        ...state,
        exercises: [
          ...state.exercises,
          {
            workoutExerciseId: action.exercise.localKey,
            exerciseId: action.exercise.exerciseId,
            sets: [],
            added: {
              name: action.exercise.name,
              category: action.exercise.category,
              target: action.exercise.target,
              stats: action.exercise.stats,
            },
          },
        ],
      };

    case "REMOVE_EXERCISE": {
      const target = state.exercises[action.exerciseIndex];
      // Only session-added exercises with nothing logged can be removed.
      if (!target?.added || target.sets.length > 0) return state;
      const exercises = state.exercises.filter((_, i) => i !== action.exerciseIndex);
      const active =
        action.exerciseIndex < state.activeExerciseIndex
          ? state.activeExerciseIndex - 1
          : state.activeExerciseIndex;
      return { ...state, exercises, activeExerciseIndex: clampIndex(active, exercises.length) };
    }

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
    // A session-scoped muadil swap only exists locally — carry it over so the
    // substitute (and its stats for the strip / PR check) survives a refresh.
    if (local.substitute) {
      return { ...srvEx, sets, exerciseId: local.exerciseId, substitute: local.substitute };
    }
    return { ...srvEx, sets };
  });

  // Session-added exercises exist only locally: the server-built state has no
  // row for them, so carry them over whole — including already-synced sets.
  const addedExercises = persisted.exercises.filter((e) => e.added);
  const all = [...exercises, ...addedExercises];

  return {
    ...server,
    exercises: all,
    sessionId: persisted.sessionId ?? server.sessionId,
    startedAt: persisted.startedAt ?? server.startedAt,
    finishedAt: persisted.finishedAt,
    activeExerciseIndex: clampIndex(persisted.activeExerciseIndex, all.length),
    rest: persisted.rest,
  };
}
