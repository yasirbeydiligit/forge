# Forge — Live Session Logger (Canlı Seans Oynatıcısı)

**Date:** 2026-06-18
**Branch:** `feature/live-session-logger`

The most critical screen in Forge: the in-gym live workout logging experience.
Phone in hand, sweaty fingers, short rests, divided attention. Must be fast,
fluid, one-handed, easy on the eyes — while keeping Forge's calm editorial
identity (cream paper, dark-green accent, serif headings, mono figures,
hairline rules, soft shadows).

## Decisions (locked)

- **Location:** dedicated full-screen route `/antrenman/[date]/seans?a=<assignmentId>`,
  rendered as a `fixed inset-0 z-50` overlay above the app shell + bottom nav
  (full thumb zone, no chrome). `/antrenman/[date]` becomes a lightweight
  **overview** with a "Antrenmanı başlat / Devam et" CTA per assignment.
- **State & sync:** client-first. Optimistic UI, durable in `localStorage`,
  background sync to JSON server actions, offline queue flushed on reconnect.
  No schema or RLS change.
- **Theme:** light editorial (cream paper). `DESIGN.md` is the source of truth
  ("uygulama daima açık"); the dark mockup is an earlier concept only.
- **Schema:** unchanged. `log_sessions.created_at` = session start,
  `completed`/`completed_at` = end, `log_sets.created_at` = set completion time.
  Everything required already exists.

## Data flow

```
/antrenman/[date]/seans/page.tsx   (server: data loader)
  ├─ loads assignment(s) + workout_exercises (+ exercise) for the date
  ├─ loads athlete history sets → computeExerciseStats() per exercise
  ├─ loads existing log_session + its log_sets (for resume)
  └─ renders <SessionPlayer initialData={...} />  (client, fixed inset-0 z-50)

SessionPlayer (client)
  ├─ useSessionReducer  → state persisted to localStorage
  │     key: forge:session:v1:<date>:<assignmentId>
  ├─ useSyncQueue       → flush mutations to server actions (offline-aware)
  └─ renders Start / Active / Summary phases
```

### Server actions (`seans/actions.ts`, JSON in/out — existing FormData actions untouched)

- `startSessionAction({date, assignmentId, workoutId}) → {sessionId, startedAt}`
  (reuses `ensureSession`; `created_at` is the real start).
- `logSetAction({sessionId|date+assignment, exerciseId, workoutExerciseId, setNumber, weight, reps, rpe, note}) → {id}`
  (returns the row id so the client can reconcile the optimistic localId).
- `deleteSetAction({id}) → void`.
- `finishSessionAction({sessionId, completed, notes}) → void`.

All revalidate `/antrenman/[date]` so the overview + coach view stay fresh.

### Client state shape

```ts
type SetEntry = {
  localId: string;        // client-generated, stable across reconcile
  serverId?: string;      // filled once synced
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  note: string | null;
  status: "completed";    // only completed sets are stored/synced
  completedAt: number;    // ms epoch
  pr?: boolean;           // beat all-time weight or est-1RM at completion
};

type ExerciseState = {
  workoutExerciseId: string;
  exerciseId: string;
  sets: SetEntry[];
};

type SessionState = {
  date: string;
  assignmentId: string;
  workoutId: string;
  sessionId: string | null;   // server session id once started
  startedAt: number | null;   // ms epoch; null = not started
  finishedAt: number | null;
  activeExerciseIndex: number;
  exercises: ExerciseState[];
  rest: { exerciseIndex: number; endsAt: number } | null;
};
```

### Sync queue

A FIFO of pending operations (`start`, `logSet`, `deleteSet`, `finish`).
`localStorage` is the durable layer, so nothing is lost if the network is
down or the tab closes. Online → flush in order, reconcile returned ids back
into state. `online`/`offline` events drive a small status indicator. A
deleted-but-unsynced set is dropped from the queue rather than round-tripped.

### Resume / hydrate

On mount, merge server `loggedSets` (durable, cross-device) with any
`localStorage` state (cursor position, rest timer, in-flight queue). Server
sets are the source of truth for *what was logged*; local state restores
*where you were*.

## Session flow (phases)

1. **Start** — if no session yet: workout name, exercise count, planned
   overview, one big **Antrenmanı başlat**. One tap → `startSessionAction`,
   timer begins, jump to first incomplete exercise. If sets already exist,
   skip straight into Active at the right cursor (= "Devam et").
2. **Active** — single exercise in focus; peers dimmed above/below and tappable.
   - Thin top bar: subtle session elapsed timer, "Egzersiz n/N", close (X →
     back to overview; session persists).
   - Focus card: serif exercise name, planned scheme line, completed sets
     (dimmed, check, VS-LAST delta), active set input row.
   - Set input: big mono weight with ±2.5 steppers + free numeric; reps with
     ± steppers; placeholders prefilled from target / last session. Optional
     RPE and "+ not" (hidden by default).
   - Primary action (thumb zone, bottom): **Set tamamlandı** → optimistic add,
     success micro-anim, advance to next set. One-tap "Dinlen m:ss" rest chip.
   - Rest timer: big countdown + shrinking ring; skippable; never blocks the
     next set. On finish: subtle pulse + optional vibrate/sound (user setting).
   - Integrated history (collapsible): est-1RM, PR, volume/4w, RPE/4w, last
     sessions, sparkline trend (reuses `computeExerciseStats`).
   - **Sonraki egzersiz** action; skip/reorder via a small menu.
   - PR: when a completed set beats all-time weight or est-1RM, inline "PR"
     badge + brief accent glow.
3. **Summary** — last exercise done (or "Seansı bitir"): total time, total
   volume (Σ kg×reps), set count, PR list, one contextual research MarginNote
   (reuses athlete insights). Optional session note + "Feed'de paylaş" +
   "Bitir" (marks completed, returns to overview).

## Micro-interactions (Forge motion tokens)

- Set complete: check draw + row settle (`--dur-base`, `--ease-out`).
- PR: brief accent glow on the value.
- Rest ring: linear countdown; gentle pulse on finish.
- Exercise transition: cross-fade/slide of the focus card (`--dur-base`).
- All gated by `prefers-reduced-motion` (global rule already zeroes durations).

## Files

- `src/lib/session/types.ts` — shared types.
- `src/lib/session/reducer.ts` — pure reducer + helpers (PR detect, volume). *(tested)*
- `src/lib/session/storage.ts` — localStorage load/save (versioned key). *(tested)*
- `src/lib/session/sync-queue.ts` — pure queue reduce/flush planning. *(tested)*
- `src/app/(app)/antrenman/[date]/seans/actions.ts` — JSON server actions.
- `src/app/(app)/antrenman/[date]/seans/page.tsx` — server data loader.
- `src/app/(app)/antrenman/[date]/seans/session-player.tsx` — client player + subcomponents.
- `src/app/(app)/antrenman/[date]/page.tsx` — trimmed to overview + CTA.

## Testing

**Unit (vitest, node):**
- reducer: start, add/complete/delete set, advance exercise, resume/hydrate merge.
- PR detection: weight PR + est-1RM PR (Brzycki), no false positives.
- sync queue: enqueue, flush order, reconcile serverId, drop unsynced delete.
- storage: round-trip + version mismatch → ignore.

**Manual E2E scenario:** see "Manual test scenario" below (filled at the end).
