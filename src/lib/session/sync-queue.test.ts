import { describe, it, expect } from "vitest";

import { queueReducer, type QueueOp, type LogSetPayload } from "./sync-queue";

const payload: LogSetPayload = {
  date: "2026-06-18",
  assignmentId: "a1",
  workoutId: "w1",
  exerciseId: "e1",
  workoutExerciseId: "we1",
  setNumber: 1,
  weight: 100,
  reps: 5,
  rpe: null,
  note: null,
};

function logOp(localId: string): QueueOp {
  return { kind: "logSet", localId, payload: { ...payload } };
}

describe("queueReducer", () => {
  it("LOG appends a logSet op in order", () => {
    let q: QueueOp[] = [];
    q = queueReducer(q, { type: "LOG", localId: "a", payload });
    q = queueReducer(q, { type: "LOG", localId: "b", payload });
    expect(q.map((o) => o.kind === "logSet" && o.localId)).toEqual(["a", "b"]);
  });

  it("SYNCED removes the matching logSet op", () => {
    const q = queueReducer([logOp("a"), logOp("b")], { type: "SYNCED", localId: "a" });
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "logSet", localId: "b" });
  });

  it("DELETE cancels a still-pending create instead of queueing a server delete", () => {
    const q = queueReducer([logOp("a")], { type: "DELETE", localId: "a", serverId: null });
    expect(q).toEqual([]);
  });

  it("DELETE of an already-synced set queues a server delete", () => {
    const q = queueReducer([], { type: "DELETE", localId: "a", serverId: "srv1" });
    expect(q).toEqual([{ kind: "deleteSet", serverId: "srv1" }]);
  });

  it("DELETE with no pending op and no serverId is a no-op", () => {
    const q = queueReducer([logOp("b")], { type: "DELETE", localId: "a", serverId: null });
    expect(q).toEqual([logOp("b")]);
  });
});
