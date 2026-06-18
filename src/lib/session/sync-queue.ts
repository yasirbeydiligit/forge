/**
 * Pure offline sync-queue model. The React hook owns the side effects (calling
 * server actions, listening for `online`/`offline`); this module only decides
 * how the queue evolves. localStorage persists the queue, so queued work
 * survives a reload or a closed tab.
 */

export type LogSetPayload = {
  date: string;
  assignmentId: string;
  workoutId: string;
  exerciseId: string;
  workoutExerciseId: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  note: string | null;
};

export type QueueOp =
  | { kind: "logSet"; localId: string; payload: LogSetPayload }
  | { kind: "deleteSet"; serverId: string };

export type QueueEvent =
  | { type: "LOG"; localId: string; payload: LogSetPayload }
  | { type: "SYNCED"; localId: string }
  | { type: "DELETE"; localId: string; serverId: string | null };

function isPendingLog(op: QueueOp, localId: string): boolean {
  return op.kind === "logSet" && op.localId === localId;
}

export function queueReducer(queue: QueueOp[], event: QueueEvent): QueueOp[] {
  switch (event.type) {
    case "LOG":
      return [...queue, { kind: "logSet", localId: event.localId, payload: event.payload }];

    case "SYNCED":
      return queue.filter((op) => !isPendingLog(op, event.localId));

    case "DELETE": {
      const hasPending = queue.some((op) => isPendingLog(op, event.localId));
      // A set deleted before its create ever synced never needs to reach the
      // server — just drop the queued create.
      if (hasPending) return queue.filter((op) => !isPendingLog(op, event.localId));
      if (event.serverId) return [...queue, { kind: "deleteSet", serverId: event.serverId }];
      return queue;
    }

    default:
      return queue;
  }
}
