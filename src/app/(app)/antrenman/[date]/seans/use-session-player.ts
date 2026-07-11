"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PRResult } from "@/lib/pr/evaluate-pr";
import {
  createInitialState,
  hydrate,
  sessionReducer,
  type AddedExerciseInput,
  type InitInput,
  type SessionAction,
  type SubstituteInput,
} from "@/lib/session/reducer";
import {
  loadQueue,
  loadState,
  queueKey,
  saveQueue,
  saveState,
  sessionKey,
} from "@/lib/session/storage";
import { detectPrResult } from "@/lib/session/totals";
import { queueReducer, type QueueEvent, type QueueOp } from "@/lib/session/sync-queue";
import type { SessionState } from "@/lib/session/types";

import {
  deleteSetAction,
  finishSessionAction,
  logSetAction,
  startSessionAction,
} from "./actions";
import type { PlayerData } from "./player-data";

const SETTINGS_KEY = "forge:session:settings:v1";

export type SetInput = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  note: string | null;
};

function buildInit(data: PlayerData): InitInput {
  return {
    date: data.date,
    assignmentId: data.assignmentId,
    workoutId: data.workoutId,
    sessionId: null,
    startedAt: data.startedAtMs,
    exercises: data.exercises.map((e) => ({
      workoutExerciseId: e.workoutExerciseId,
      exerciseId: e.exerciseId,
      serverSets: e.serverSets,
    })),
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** A soft chime when a rest timer ends, lazily using the Web Audio API. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch {
    // Audio is best-effort; ignore unsupported / blocked contexts.
  }
}

export function useSessionPlayer(data: PlayerData) {
  const sKey = sessionKey(data.date, data.assignmentId);
  const qKey = queueKey(data.date, data.assignmentId);

  const [state, setState] = useState<SessionState>(() => createInitialState(buildInit(data)));
  const [queue, setQueue] = useState<QueueOp[]>([]);
  const [online, setOnline] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [soundHaptics, setSoundHaptics] = useState(true);
  const [autoRest, setAutoRest] = useState(true);

  const stateRef = useRef(state);
  stateRef.current = state;
  const flushing = useRef(false);
  const [retryTick, setRetryTick] = useState(0);

  const dispatch = useCallback((action: SessionAction) => {
    setState((s) => sessionReducer(s, action));
  }, []);

  const enqueue = useCallback(
    (event: QueueEvent) => {
      setQueue((q) => queueReducer(q, event));
    },
    [],
  );

  // ---- One-time hydration from localStorage (client only) ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = loadState(window.localStorage, sKey);
    setState((server) => hydrate({ server, persisted }));
    setQueue(loadQueue(window.localStorage, qKey));
    setOnline(navigator.onLine);
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setSoundHaptics(s?.soundHaptics !== false);
        setAutoRest(s?.autoRest !== false);
      }
    } catch {
      /* keep defaults */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist on change (after hydration so we never clobber stored state) ----
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    saveState(window.localStorage, sKey, state);
  }, [state, hydrated, sKey]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    saveQueue(window.localStorage, qKey, queue);
  }, [queue, hydrated, qKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundHaptics, autoRest }));
    } catch {
      /* ignore */
    }
  }, [soundHaptics, autoRest]);

  // ---- Online / offline ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ---- Sync flusher: process the head op whenever online + non-empty ----
  useEffect(() => {
    if (!hydrated || !online || queue.length === 0 || flushing.current) return;
    const op = queue[0];
    flushing.current = true;
    void (async () => {
      try {
        if (op.kind === "logSet") {
          const res = await logSetAction(op.payload);
          if ("error" in res) {
            await delay(1500);
          } else {
            dispatch({ type: "RECONCILE_SET", localId: op.localId, serverId: res.id });
            // Remove by id (a concurrent DELETE may already have dropped it).
            setQueue((q) => queueReducer(q, { type: "SYNCED", localId: op.localId }));
          }
        } else {
          const res = await deleteSetAction({ id: op.serverId, date: data.date });
          if ("error" in res) await delay(1500);
          else setQueue((q) => q.filter((o) => o !== op));
        }
      } catch {
        await delay(1500);
      } finally {
        flushing.current = false;
        setRetryTick((t) => t + 1); // re-trigger if the queue didn't change
      }
    })();
  }, [queue, online, hydrated, retryTick, dispatch, data.date]);

  // ---- Pending finish retry (finishing offline) ----
  const pendingFinish = useRef<{ completed: boolean; notes: string | null } | null>(null);
  const runFinish = useCallback(async () => {
    const payload = pendingFinish.current;
    if (!payload) return;
    try {
      const res = await finishSessionAction({
        date: data.date,
        assignmentId: data.assignmentId,
        workoutId: data.workoutId,
        completed: payload.completed,
        notes: payload.notes,
      });
      if (!("error" in res)) pendingFinish.current = null;
    } catch {
      // Offline / transient: keep pendingFinish; the online effect retries.
    }
  }, [data.date, data.assignmentId, data.workoutId]);

  useEffect(() => {
    if (online && pendingFinish.current) void runFinish();
  }, [online, retryTick, runFinish]);

  // ---- Public actions ----
  const start = useCallback(() => {
    if (stateRef.current.startedAt != null) return;
    const startedAt = Date.now();
    dispatch({ type: "START", sessionId: stateRef.current.sessionId ?? "pending", startedAt });
    void startSessionAction({
      date: data.date,
      assignmentId: data.assignmentId,
      workoutId: data.workoutId,
    })
      .then((res) => {
        if (!("error" in res)) {
          dispatch({ type: "START", sessionId: res.sessionId, startedAt });
        }
      })
      // Offline at start is fine: the first synced set creates the session.
      .catch(() => {});
  }, [dispatch, data.date, data.assignmentId, data.workoutId]);

  const completeSet = useCallback(
    (exerciseIndex: number, input: SetInput): PRResult => {
      const ex = stateRef.current.exercises[exerciseIndex];
      const meta = data.exercises[exerciseIndex];
      if (!ex || (!meta && !ex.added)) return { isPR: false, type: null, reference: null };
      // History = the exercise's all-time PR frontier plus the sets already done
      // this session, so progressive sets within one workout can also be PRs.
      // Muadil swaps and session-added exercises bring their own frontier (the
      // program exercise's history would be the wrong exercise to beat).
      const baseHistory = ex.added
        ? ex.added.stats.prHistory
        : ex.substitute
          ? ex.substitute.stats.prHistory
          : meta!.stats.prHistory;
      const history = [
        ...baseHistory,
        ...ex.sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir })),
      ];
      const pr = detectPrResult(history, {
        weight: input.weight,
        reps: input.reps,
        rir: input.rir,
      });
      const localId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `l-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Stamp the completion time once and reuse it for both local state and the
      // server payload, so the recorded performed_at is the real workout time
      // even when the set syncs much later (offline).
      const completedAt = Date.now();

      dispatch({
        type: "COMPLETE_SET",
        exerciseIndex,
        set: {
          localId,
          serverId: null,
          weight: input.weight,
          reps: input.reps,
          rir: input.rir,
          note: input.note,
          completedAt,
          pr: pr.isPR,
          prType: pr.type,
        },
      });
      enqueue({
        type: "LOG",
        localId,
        payload: {
          date: data.date,
          assignmentId: data.assignmentId,
          workoutId: data.workoutId,
          exerciseId: ex.exerciseId,
          // Added exercises have no program row; the server accepts null.
          workoutExerciseId: ex.added ? null : ex.workoutExerciseId,
          setNumber: ex.sets.length + 1,
          weight: input.weight,
          reps: input.reps,
          rir: input.rir,
          note: input.note,
          performedAt: new Date(completedAt).toISOString(),
        },
      });
      return pr;
    },
    [dispatch, enqueue, data],
  );

  const deleteSet = useCallback(
    (localId: string) => {
      let serverId: string | null = null;
      for (const ex of stateRef.current.exercises) {
        const found = ex.sets.find((s) => s.localId === localId);
        if (found) {
          serverId = found.serverId;
          break;
        }
      }
      dispatch({ type: "DELETE_SET", localId });
      enqueue({ type: "DELETE", localId, serverId });
    },
    [dispatch, enqueue],
  );

  const setActiveExercise = useCallback(
    (index: number) => dispatch({ type: "SET_ACTIVE_EXERCISE", index }),
    [dispatch],
  );

  /** Session-scoped muadil swap; the program template is never mutated. */
  const substituteExercise = useCallback(
    (exerciseIndex: number, substitute: SubstituteInput) =>
      dispatch({ type: "SUBSTITUTE_EXERCISE", exerciseIndex, substitute }),
    [dispatch],
  );

  /** Session-scoped extra exercise; appended after the program's list. */
  const addExercise = useCallback(
    (exercise: AddedExerciseInput) => dispatch({ type: "ADD_EXERCISE", exercise }),
    [dispatch],
  );

  /** Remove a session-added exercise (reducer refuses once sets are logged). */
  const removeExercise = useCallback(
    (exerciseIndex: number) => dispatch({ type: "REMOVE_EXERCISE", exerciseIndex }),
    [dispatch],
  );

  const startRest = useCallback(
    (exerciseIndex: number, seconds: number) =>
      dispatch({ type: "START_REST", exerciseIndex, endsAt: Date.now() + seconds * 1000 }),
    [dispatch],
  );

  const extendRest = useCallback(
    (seconds: number) => {
      const rest = stateRef.current.rest;
      if (!rest) return;
      // Clamp so removing time never lands before "now".
      const endsAt = Math.max(Date.now(), rest.endsAt + seconds * 1000);
      dispatch({ type: "START_REST", exerciseIndex: rest.exerciseIndex, endsAt });
    },
    [dispatch],
  );

  const clearRest = useCallback(() => dispatch({ type: "CLEAR_REST" }), [dispatch]);

  const notifyRestDone = useCallback(() => {
    if (!soundHaptics) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(180);
    playChime();
  }, [soundHaptics]);

  // Show the summary without committing yet (so "geri dön" is free).
  const goToSummary = useCallback(() => {
    dispatch({ type: "FINISH", finishedAt: Date.now() });
  }, [dispatch]);

  // Commit completion to the server (with offline retry) — called from summary.
  const finish = useCallback(
    (notes: string | null) => {
      dispatch({ type: "FINISH", finishedAt: stateRef.current.finishedAt ?? Date.now() });
      pendingFinish.current = { completed: true, notes };
      void runFinish();
    },
    [dispatch, runFinish],
  );

  const reopen = useCallback(() => {
    dispatch({ type: "REOPEN" });
  }, [dispatch]);

  return {
    state,
    online,
    hydrated,
    isSyncing: queue.length > 0,
    pendingCount: queue.length,
    soundHaptics,
    setSoundHaptics,
    autoRest,
    setAutoRest,
    start,
    completeSet,
    deleteSet,
    setActiveExercise,
    substituteExercise,
    addExercise,
    removeExercise,
    startRest,
    extendRest,
    clearRest,
    notifyRestDone,
    goToSummary,
    finish,
    reopen,
  };
}
