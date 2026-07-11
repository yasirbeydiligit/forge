import { describe, it, expect } from "vitest";

import { createInitialState, sessionReducer, hydrate } from "./reducer";
import type { SetEntry } from "./types";
import { SESSION_STATE_VERSION } from "./types";

function set(overrides: Partial<SetEntry> = {}): SetEntry {
  return {
    localId: "l1",
    serverId: null,
    weight: 100,
    reps: 5,
    rir: null,
    note: null,
    completedAt: 1000,
    pr: false,
    ...overrides,
  };
}

const baseInput = {
  date: "2026-06-18",
  assignmentId: "a1",
  workoutId: "w1",
  sessionId: null,
  startedAt: null,
  exercises: [
    { workoutExerciseId: "we1", exerciseId: "e1", serverSets: [] },
    { workoutExerciseId: "we2", exerciseId: "e2", serverSets: [] },
  ],
};

describe("createInitialState", () => {
  it("builds one ExerciseState per input exercise, all empty", () => {
    const s = createInitialState(baseInput);
    expect(s.version).toBe(SESSION_STATE_VERSION);
    expect(s.exercises).toHaveLength(2);
    expect(s.exercises[0]).toMatchObject({
      workoutExerciseId: "we1",
      exerciseId: "e1",
      sets: [],
    });
    expect(s.startedAt).toBeNull();
    expect(s.sessionId).toBeNull();
    expect(s.activeExerciseIndex).toBe(0);
  });

  it("maps server sets into completed SetEntries with serverId set", () => {
    const s = createInitialState({
      ...baseInput,
      exercises: [
        {
          workoutExerciseId: "we1",
          exerciseId: "e1",
          serverSets: [
            { id: "srv1", weight: 100, reps: 5, rir: 8, note: null, completedAt: 500 },
          ],
        },
        { workoutExerciseId: "we2", exerciseId: "e2", serverSets: [] },
      ],
    });
    expect(s.exercises[0].sets).toHaveLength(1);
    expect(s.exercises[0].sets[0]).toMatchObject({
      serverId: "srv1",
      weight: 100,
      reps: 5,
      rir: 8,
    });
    // resume cursor lands on the first exercise that has no sets yet
    expect(s.activeExerciseIndex).toBe(1);
  });

  it("lands the cursor on the last exercise when every exercise has sets", () => {
    const s = createInitialState({
      ...baseInput,
      exercises: [
        {
          workoutExerciseId: "we1",
          exerciseId: "e1",
          serverSets: [{ id: "x", weight: 1, reps: 1, rir: null, note: null, completedAt: 1 }],
        },
        {
          workoutExerciseId: "we2",
          exerciseId: "e2",
          serverSets: [{ id: "y", weight: 1, reps: 1, rir: null, note: null, completedAt: 1 }],
        },
      ],
    });
    expect(s.activeExerciseIndex).toBe(1);
  });
});

describe("sessionReducer", () => {
  it("START sets the session id, start time and resets the cursor", () => {
    const s = createInitialState(baseInput);
    const next = sessionReducer(s, { type: "START", sessionId: "sess1", startedAt: 42 });
    expect(next.sessionId).toBe("sess1");
    expect(next.startedAt).toBe(42);
  });

  it("COMPLETE_SET appends the set to the target exercise only", () => {
    const s = createInitialState(baseInput);
    const next = sessionReducer(s, {
      type: "COMPLETE_SET",
      exerciseIndex: 1,
      set: set({ localId: "l9" }),
    });
    expect(next.exercises[0].sets).toHaveLength(0);
    expect(next.exercises[1].sets).toHaveLength(1);
    expect(next.exercises[1].sets[0].localId).toBe("l9");
  });

  it("RECONCILE_SET attaches the server id to the matching local set", () => {
    let s = createInitialState(baseInput);
    s = sessionReducer(s, { type: "COMPLETE_SET", exerciseIndex: 0, set: set({ localId: "l9" }) });
    s = sessionReducer(s, { type: "RECONCILE_SET", localId: "l9", serverId: "srv9" });
    expect(s.exercises[0].sets[0].serverId).toBe("srv9");
  });

  it("DELETE_SET removes the set with the matching localId", () => {
    let s = createInitialState(baseInput);
    s = sessionReducer(s, { type: "COMPLETE_SET", exerciseIndex: 0, set: set({ localId: "a" }) });
    s = sessionReducer(s, { type: "COMPLETE_SET", exerciseIndex: 0, set: set({ localId: "b" }) });
    s = sessionReducer(s, { type: "DELETE_SET", localId: "a" });
    expect(s.exercises[0].sets.map((x) => x.localId)).toEqual(["b"]);
  });

  it("SET_ACTIVE_EXERCISE clamps the index into range", () => {
    const s = createInitialState(baseInput);
    expect(sessionReducer(s, { type: "SET_ACTIVE_EXERCISE", index: 5 }).activeExerciseIndex).toBe(1);
    expect(sessionReducer(s, { type: "SET_ACTIVE_EXERCISE", index: -3 }).activeExerciseIndex).toBe(0);
  });

  it("START_REST / CLEAR_REST toggle the rest timer", () => {
    let s = createInitialState(baseInput);
    s = sessionReducer(s, { type: "START_REST", exerciseIndex: 0, endsAt: 9999 });
    expect(s.rest).toEqual({ exerciseIndex: 0, endsAt: 9999 });
    s = sessionReducer(s, { type: "CLEAR_REST" });
    expect(s.rest).toBeNull();
  });

  it("FINISH then REOPEN set and clear finishedAt", () => {
    let s = createInitialState(baseInput);
    s = sessionReducer(s, { type: "FINISH", finishedAt: 123 });
    expect(s.finishedAt).toBe(123);
    s = sessionReducer(s, { type: "REOPEN" });
    expect(s.finishedAt).toBeNull();
  });

  it("does not mutate the previous state object", () => {
    const s = createInitialState(baseInput);
    const next = sessionReducer(s, { type: "COMPLETE_SET", exerciseIndex: 0, set: set() });
    expect(s.exercises[0].sets).toHaveLength(0); // original untouched
    expect(next).not.toBe(s);
  });
});

const substitute = {
  exerciseId: "e9",
  name: "Chest Press Machine",
  category: "İtiş",
  stats: {
    allTimePr: 80,
    prevSessionWeights: [75, 75],
    prevSessionSets: [{ weight: 75, reps: 10 }],
    prHistory: [{ weight: 80, reps: 8, rir: null }],
  },
};

describe("SUBSTITUTE_EXERCISE", () => {
  it("swaps the exercise id and records the substitution (original id kept)", () => {
    const s = createInitialState(baseInput);
    const next = sessionReducer(s, {
      type: "SUBSTITUTE_EXERCISE",
      exerciseIndex: 1,
      substitute,
    });
    expect(next.exercises[1].exerciseId).toBe("e9");
    expect(next.exercises[1].substitute).toMatchObject({
      originalExerciseId: "e2",
      name: "Chest Press Machine",
    });
    // untouched sibling
    expect(next.exercises[0].exerciseId).toBe("e1");
    expect(next.exercises[0].substitute).toBeUndefined();
  });

  it("keeps the FIRST original id when substituting twice", () => {
    let s = createInitialState(baseInput);
    s = sessionReducer(s, { type: "SUBSTITUTE_EXERCISE", exerciseIndex: 1, substitute });
    s = sessionReducer(s, {
      type: "SUBSTITUTE_EXERCISE",
      exerciseIndex: 1,
      substitute: { ...substitute, exerciseId: "e10", name: "Incline DB Press" },
    });
    expect(s.exercises[1].exerciseId).toBe("e10");
    expect(s.exercises[1].substitute?.originalExerciseId).toBe("e2");
  });

  it("clears the substitution when swapping back to the original exercise", () => {
    let s = createInitialState(baseInput);
    s = sessionReducer(s, { type: "SUBSTITUTE_EXERCISE", exerciseIndex: 1, substitute });
    s = sessionReducer(s, {
      type: "SUBSTITUTE_EXERCISE",
      exerciseIndex: 1,
      substitute: { ...substitute, exerciseId: "e2" },
    });
    expect(s.exercises[1].exerciseId).toBe("e2");
    expect(s.exercises[1].substitute).toBeNull();
  });
});

const addedExercise = {
  localKey: "local-add-1",
  exerciseId: "e20",
  name: "Face Pull",
  category: "Omuz",
  target: { sets: 3, repsMin: null, repsMax: null, weight: null, rir: null, restSeconds: 90 },
  stats: {
    allTimePr: 25,
    prevSessionWeights: [22.5],
    prevSessionSets: [{ weight: 22.5, reps: 15 }],
    prHistory: [{ weight: 25, reps: 12, rir: null }],
  },
};

describe("ADD_EXERCISE / REMOVE_EXERCISE", () => {
  it("appends a session-scoped exercise with its own target and stats", () => {
    const s = sessionReducer(createInitialState(baseInput), {
      type: "ADD_EXERCISE",
      exercise: addedExercise,
    });
    expect(s.exercises).toHaveLength(3);
    const added = s.exercises[2];
    expect(added.workoutExerciseId).toBe("local-add-1");
    expect(added.exerciseId).toBe("e20");
    expect(added.sets).toEqual([]);
    expect(added.added).toMatchObject({ name: "Face Pull", target: { sets: 3 } });
  });

  it("REMOVE_EXERCISE removes an added exercise without sets and clamps the cursor", () => {
    let s = sessionReducer(createInitialState(baseInput), {
      type: "ADD_EXERCISE",
      exercise: addedExercise,
    });
    s = sessionReducer(s, { type: "SET_ACTIVE_EXERCISE", index: 2 });
    s = sessionReducer(s, { type: "REMOVE_EXERCISE", exerciseIndex: 2 });
    expect(s.exercises).toHaveLength(2);
    expect(s.activeExerciseIndex).toBe(1);
  });

  it("REMOVE_EXERCISE refuses program exercises and added ones with logged sets", () => {
    let s = sessionReducer(createInitialState(baseInput), {
      type: "ADD_EXERCISE",
      exercise: addedExercise,
    });
    // program exercise: untouched
    expect(sessionReducer(s, { type: "REMOVE_EXERCISE", exerciseIndex: 0 }).exercises).toHaveLength(3);
    // added but has a set: untouched
    s = sessionReducer(s, { type: "COMPLETE_SET", exerciseIndex: 2, set: set() });
    expect(sessionReducer(s, { type: "REMOVE_EXERCISE", exerciseIndex: 2 }).exercises).toHaveLength(3);
  });
});

describe("hydrate", () => {
  it("keeps unsynced local sets (serverId null) and merges in server sets", () => {
    const server = createInitialState({
      ...baseInput,
      exercises: [
        {
          workoutExerciseId: "we1",
          exerciseId: "e1",
          serverSets: [{ id: "srv1", weight: 100, reps: 5, rir: null, note: null, completedAt: 1 }],
        },
        { workoutExerciseId: "we2", exerciseId: "e2", serverSets: [] },
      ],
      sessionId: "sess1",
      startedAt: 10,
    });
    // local has the same synced set plus one not-yet-synced set, and a moved cursor.
    let persisted = createInitialState(baseInput);
    persisted = sessionReducer(persisted, { type: "START", sessionId: "sess1", startedAt: 10 });
    persisted = sessionReducer(persisted, {
      type: "COMPLETE_SET",
      exerciseIndex: 0,
      set: set({ localId: "lsynced", serverId: "srv1" }),
    });
    persisted = sessionReducer(persisted, {
      type: "COMPLETE_SET",
      exerciseIndex: 0,
      set: set({ localId: "lpending", serverId: null }),
    });
    persisted = sessionReducer(persisted, { type: "SET_ACTIVE_EXERCISE", index: 1 });

    const merged = hydrate({ server, persisted });
    // server set (srv1) present once + the pending unsynced set preserved
    expect(merged.exercises[0].sets).toHaveLength(2);
    expect(merged.exercises[0].sets.some((x) => x.serverId === "srv1")).toBe(true);
    expect(merged.exercises[0].sets.some((x) => x.localId === "lpending")).toBe(true);
    // local cursor / start info wins
    expect(merged.activeExerciseIndex).toBe(1);
    expect(merged.startedAt).toBe(10);
  });

  it("returns server state untouched when there is no persisted state", () => {
    const server = createInitialState(baseInput);
    expect(hydrate({ server, persisted: null })).toBe(server);
  });

  it("appends locally-added exercises (with ALL their sets) after the server list", () => {
    const server = createInitialState(baseInput);
    let persisted = createInitialState(baseInput);
    persisted = sessionReducer(persisted, { type: "ADD_EXERCISE", exercise: addedExercise });
    // one synced + one pending set on the added exercise — both must survive,
    // because the server-built state knows nothing about this exercise.
    persisted = sessionReducer(persisted, {
      type: "COMPLETE_SET",
      exerciseIndex: 2,
      set: set({ localId: "as1", serverId: "srv-a1" }),
    });
    persisted = sessionReducer(persisted, {
      type: "COMPLETE_SET",
      exerciseIndex: 2,
      set: set({ localId: "as2", serverId: null }),
    });

    const merged = hydrate({ server, persisted });
    expect(merged.exercises).toHaveLength(3);
    const added = merged.exercises[2];
    expect(added.added?.name).toBe("Face Pull");
    expect(added.sets.map((x) => x.localId)).toEqual(["as1", "as2"]);
  });

  it("carries a local substitution over the server-built exercise", () => {
    const server = createInitialState(baseInput);
    let persisted = createInitialState(baseInput);
    persisted = sessionReducer(persisted, {
      type: "SUBSTITUTE_EXERCISE",
      exerciseIndex: 1,
      substitute,
    });

    const merged = hydrate({ server, persisted });
    expect(merged.exercises[1].exerciseId).toBe("e9");
    expect(merged.exercises[1].substitute?.originalExerciseId).toBe("e2");
    // non-substituted exercise untouched
    expect(merged.exercises[0].exerciseId).toBe("e1");
  });
});
