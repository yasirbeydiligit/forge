import type { SessionState } from "./types";
import { SESSION_STATE_VERSION } from "./types";
import type { QueueOp } from "./sync-queue";

/** The subset of the Web Storage API we depend on (injectable for tests). */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function sessionKey(date: string, assignmentId: string): string {
  return `forge:session:v${SESSION_STATE_VERSION}:${date}:${assignmentId}`;
}

export function queueKey(date: string, assignmentId: string): string {
  return `forge:session-queue:v${SESSION_STATE_VERSION}:${date}:${assignmentId}`;
}

export function saveState(storage: StorageLike, key: string, state: SessionState): void {
  try {
    storage.setItem(key, JSON.stringify(state));
  } catch {
    // Quota or serialization failure is non-fatal; in-memory state continues.
  }
}

export function loadState(storage: StorageLike, key: string): SessionState | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed?.version !== SESSION_STATE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveQueue(storage: StorageLike, key: string, queue: QueueOp[]): void {
  try {
    storage.setItem(key, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function loadQueue(storage: StorageLike, key: string): QueueOp[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueOp[]) : [];
  } catch {
    return [];
  }
}
