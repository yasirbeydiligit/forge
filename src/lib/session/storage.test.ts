import { describe, it, expect } from "vitest";

import {
  loadState,
  saveState,
  loadQueue,
  saveQueue,
  sessionKey,
  queueKey,
} from "./storage";
import { createInitialState } from "./reducer";
import { SESSION_STATE_VERSION } from "./types";
import type { QueueOp } from "./sync-queue";

/** Minimal in-memory Storage stand-in for node tests. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

const init = createInitialState({
  date: "2026-06-18",
  assignmentId: "a1",
  workoutId: "w1",
  sessionId: null,
  startedAt: null,
  exercises: [{ workoutExerciseId: "we1", exerciseId: "e1", serverSets: [] }],
});

describe("keys", () => {
  it("namespaces by date + assignment", () => {
    expect(sessionKey("2026-06-18", "a1")).toBe("forge:session:v1:2026-06-18:a1");
    expect(queueKey("2026-06-18", "a1")).toBe("forge:session-queue:v1:2026-06-18:a1");
  });
});

describe("session state persistence", () => {
  it("round-trips a saved state", () => {
    const s = fakeStorage();
    const key = sessionKey("2026-06-18", "a1");
    saveState(s, key, init);
    expect(loadState(s, key)).toEqual(init);
  });

  it("returns null when nothing is stored", () => {
    expect(loadState(fakeStorage(), "missing")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    const s = fakeStorage();
    s.setItem("k", "{not json");
    expect(loadState(s, "k")).toBeNull();
  });

  it("ignores state from a different schema version", () => {
    const s = fakeStorage();
    s.setItem("k", JSON.stringify({ ...init, version: SESSION_STATE_VERSION + 1 }));
    expect(loadState(s, "k")).toBeNull();
  });
});

describe("queue persistence", () => {
  it("round-trips a saved queue", () => {
    const s = fakeStorage();
    const key = queueKey("2026-06-18", "a1");
    const queue: QueueOp[] = [{ kind: "deleteSet", serverId: "srv1" }];
    saveQueue(s, key, queue);
    expect(loadQueue(s, key)).toEqual(queue);
  });

  it("returns an empty queue when nothing is stored or data is malformed", () => {
    const s = fakeStorage();
    expect(loadQueue(s, "missing")).toEqual([]);
    s.setItem("bad", "nope");
    expect(loadQueue(s, "bad")).toEqual([]);
  });
});
