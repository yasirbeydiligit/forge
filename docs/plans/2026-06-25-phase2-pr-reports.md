# Phase 2 — PR Engine + Reports + Plateau Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Each pure-logic task uses superpowers:test-driven-development.

**Goal:** Add an observed-performance PR engine, a muscle-based post-session
report, a plateau detector, and a coach weekly report on top of the Phase 1
taxonomy — without breaking the existing logbook flow.

**Architecture:** Pure, unit-tested logic modules (`src/lib/pr`, `src/lib/reports`)
fed by RLS-aware server reads. The live session player computes PR optimistically
from a compact "PR frontier"; the post-session report and coach report recompute
server-side from saved sets (DB = source of truth). One small migration adds
`log_sets.performed_at` for accurate timing.

**Tech Stack:** Next.js 15, Drizzle ORM 0.45, Supabase (postgres + RLS), Zod,
Vitest, tsx. Turkish UI, English code.

**Design:** `docs/plans/2026-06-25-phase2-pr-reports-design.md`.

**Apply path reminder:** earlier migrations were applied live via Supabase MCP
`apply_migration`, NOT `drizzle migrate`. Apply `0018` via MCP, then regenerate
`src/lib/database.types.ts`.

---

## Task 1: PR engine — pure function (TDD)

**Files:**
- Create: `src/lib/pr/evaluate-pr.ts`
- Test: `src/lib/pr/evaluate-pr.test.ts`

**Step 1: Write failing tests** covering every design scenario:

```ts
import { describe, it, expect } from "vitest";
import { evaluatePR, type PRSet } from "./evaluate-pr";

const h = (weight: number, reps: number, rir: number | null = null): PRSet => ({ weight, reps, rir });

describe("evaluatePR — Rule A (dominance)", () => {
  it("same weight, more reps => reps PR", () => {
    expect(evaluatePR(h(100, 5), [h(100, 4)]).type).toBe("reps");
  });
  it("same reps, more weight => weight PR", () => {
    expect(evaluatePR(h(102.5, 4), [h(100, 4)]).type).toBe("weight");
  });
  it("both up => both PR", () => {
    expect(evaluatePR(h(105, 5), [h(100, 4)]).type).toBe("both");
  });
  it("identical to history => not PR", () => {
    expect(evaluatePR(h(100, 4), [h(100, 4)]).isPR).toBe(false);
  });
});

describe("evaluatePR — Rule B (trade-off)", () => {
  it("ref 4 reps: +weight, -1 rep => PR", () => {
    expect(evaluatePR(h(102.5, 3), [h(100, 4)])).toMatchObject({ isPR: true, type: "tradeoff" });
  });
  it("ref 4 reps: +weight, -2 reps => not PR", () => {
    expect(evaluatePR(h(102.5, 2), [h(100, 4)]).isPR).toBe(false);
  });
  it("ref 8 reps: must keep >=4; drop to 3 => not PR", () => {
    expect(evaluatePR(h(102.5, 3), [h(100, 8)]).isPR).toBe(false);
  });
  it("ref 8 reps: +weight, drop to 4 => PR", () => {
    expect(evaluatePR(h(102.5, 4), [h(100, 8)])).toMatchObject({ isPR: true, type: "tradeoff" });
  });
  it("low-rep (ref 3) trade-off OFF by default", () => {
    expect(evaluatePR(h(110, 2), [h(105, 3)]).isPR).toBe(false);
  });
  it("low-rep trade-off ON via config", () => {
    expect(evaluatePR(h(110, 2), [h(105, 3)], { minMaintained: { 3: 2 } }).isPR).toBe(true);
  });
});

describe("evaluatePR — guards", () => {
  it("weight decreased => never PR", () => {
    expect(evaluatePR(h(95, 6), [h(100, 5)]).isPR).toBe(false);
  });
  it("empty history => not PR (baseline)", () => {
    expect(evaluatePR(h(100, 5), []).isPR).toBe(false);
  });
  it("null weight/reps => not PR", () => {
    expect(evaluatePR({ weight: null, reps: 5, rir: null }, [h(100, 4)]).isPR).toBe(false);
  });
});

describe("evaluatePR — RIR PR", () => {
  it("same weight+reps, lower RIR => rir PR", () => {
    expect(evaluatePR(h(100, 5, 1), [h(100, 5, 3)])).toMatchObject({ isPR: true, type: "rir" });
  });
  it("RIR equal => not rir PR", () => {
    expect(evaluatePR(h(100, 5, 3), [h(100, 5, 3)]).isPR).toBe(false);
  });
  it("strength PR takes precedence over rir", () => {
    expect(evaluatePR(h(102.5, 4, 1), [h(100, 4, 3)]).type).toBe("weight");
  });
});
```

**Step 2: Run** `npm test -- evaluate-pr` → FAIL (module missing).

**Step 3: Implement** `src/lib/pr/evaluate-pr.ts`:

```ts
/**
 * Personal-record engine. PRs are determined by comparing a set to observed
 * historical sets — NO estimated-1RM formulas. See the design doc for rules.
 */
export type PRSet = { weight: number | null; reps: number | null; rir: number | null };
export type PRType = "weight" | "reps" | "both" | "tradeoff" | "rir";
export type PRResult = { isPR: boolean; type: PRType | null; reference: PRSet | null };

export type PRConfig = {
  /** reference reps -> minimum reps that must be maintained for a Rule B PR. */
  minMaintained: Record<number, number>;
  /** fallback minimum for reference reps not in the table (>8). */
  minMaintainedDefault: number;
};

export const PR_CONFIG: PRConfig = {
  minMaintained: { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 4, 8: 4 },
  minMaintainedDefault: 4,
};

function minMaintained(refReps: number, config: PRConfig): number {
  return config.minMaintained[refReps] ?? config.minMaintainedDefault;
}

/** Resolve a (possibly partial) config against PR_CONFIG defaults. */
function resolve(config?: Partial<PRConfig>): PRConfig {
  return {
    minMaintained: { ...PR_CONFIG.minMaintained, ...(config?.minMaintained ?? {}) },
    minMaintainedDefault: config?.minMaintainedDefault ?? PR_CONFIG.minMaintainedDefault,
  };
}

const no: PRResult = { isPR: false, type: null, reference: null };

export function evaluatePR(
  current: PRSet,
  history: PRSet[],
  config?: Partial<PRConfig>,
): PRResult {
  if (current.weight == null || current.reps == null || current.reps <= 0) return no;
  const cfg = resolve(config);
  const prior = history.filter(
    (p): p is { weight: number; reps: number; rir: number | null } =>
      p.weight != null && p.reps != null && p.reps > 0,
  );
  if (prior.length === 0) return no;

  const w = current.weight;
  const r = current.reps;

  // Rule A — dominance: >= on both axes, > on at least one.
  let domRef: PRSet | null = null;
  for (const p of prior) {
    if (w >= p.weight && r >= p.reps && (w > p.weight || r > p.reps)) {
      // Prefer the closest reference for readable copy.
      if (!domRef || (p.weight >= (domRef.weight ?? 0) && p.reps >= (domRef.reps ?? 0))) domRef = p;
    }
  }
  if (domRef) {
    const type: PRType = w > domRef.weight! && r > domRef.reps! ? "both" : r === domRef.reps! ? "weight" : "reps";
    return { isPR: true, type, reference: domRef };
  }

  // Rule B — trade-off: weight up, reps down within threshold.
  for (const p of prior) {
    if (w > p.weight && r < p.reps && r >= minMaintained(p.reps, cfg)) {
      return { isPR: true, type: "tradeoff", reference: p };
    }
  }

  // RIR PR — same weight+reps, lower RIR.
  if (current.rir != null) {
    for (const p of prior) {
      if (p.weight === w && p.reps === r && p.rir != null && current.rir < p.rir) {
        return { isPR: true, type: "rir", reference: p };
      }
    }
  }

  return no;
}

/**
 * Reduce a full set history to the compact frontier needed by evaluatePR:
 * non-dominated (weight,reps) pairs keeping the lowest RIR seen per pair.
 * Sufficient for Rule A/B/RIR. Used to shrink the client payload.
 */
export function prFrontier(history: PRSet[]): PRSet[] {
  const valid = history.filter((p) => p.weight != null && p.reps != null && p.reps > 0);
  // Best (lowest) RIR per (weight,reps).
  const byPair = new Map<string, PRSet>();
  for (const p of valid) {
    const k = `${p.weight}|${p.reps}`;
    const prev = byPair.get(k);
    const rir = p.rir != null && (prev?.rir == null || p.rir < prev.rir) ? p.rir : prev?.rir ?? p.rir;
    byPair.set(k, { weight: p.weight, reps: p.reps, rir });
  }
  const pairs = [...byPair.values()];
  // Keep only non-dominated pairs (no other pair with >= weight and >= reps, strictly greater somewhere).
  return pairs.filter(
    (p) => !pairs.some((q) => q !== p && q.weight! >= p.weight! && q.reps! >= p.reps! && (q.weight! > p.weight! || q.reps! > p.reps!)),
  );
}
```

**Step 4: Run** `npm test -- evaluate-pr` → PASS.

**Step 5: Commit** `feat(pr): observed-performance PR engine + frontier (TDD)`.

---

## Task 2: Migration 0018 — `log_sets.performed_at`

**Files:**
- Modify: `src/db/schema.ts` (logSets: add `performedAt: timestamp("performed_at", { withTimezone: true })`)
- Create: `drizzle/0018_*.sql` (hand SQL: `ALTER TABLE public.log_sets ADD COLUMN IF NOT EXISTS performed_at timestamptz;`)
- Journal + snapshot entry following the Phase 1 pattern.
- Modify: `src/lib/database.types.ts` (hand-add `performed_at` to log_sets Row/Insert/Update; regenerate from Supabase after live apply).

**Step 1:** Add the column to schema + the SQL file. **Step 2:** `npm run typecheck`.
**Step 3:** Commit `feat(db): log_sets.performed_at for accurate timing (0018)`.
**Apply:** via Supabase MCP `apply_migration` when user is ready; then regenerate types.

---

## Task 3: Stamp `performed_at` from the client

**Files:**
- Modify: `src/app/(app)/antrenman/[date]/seans/actions.ts` — `logSetInput` gains
  `performedAt: z.string().datetime().nullable()`; insert it.
- Modify: `src/lib/session/types.ts`, `reducer.ts`, `sync-queue.ts`,
  `use-session-player.ts` — carry the completion timestamp on the queued set
  (stamp `new Date().toISOString()` when the set is completed, so offline-queued
  sets keep the real time).

**Verify:** `npm test` (reducer/sync-queue/totals) green; `npm run typecheck`.
**Commit:** `feat(session): stamp performed_at on set completion`.

---

## Task 4: Swap live PR detection to evaluatePR; drop est-1RM + tonnage

**Files:**
- Modify: `src/lib/session/totals.ts` — replace `detectPr` body to call
  `evaluatePR(current, frontier).isPR` (+ keep `sessionTotals`; `prCount` stays).
  Drop the `brzycki` import.
- Modify: `src/lib/session/totals.test.ts` — update expectations to the new rules.
- Modify: `src/lib/logbook-stats.ts` — remove `brzycki`, `bestEst1RM`,
  `setsVolume` (tonnage); add `prFrontier`-shaped data + `volumeSets` (set count)
  to `ExerciseStats`. Keep recent sessions/trend (trend now = top weight, fine).
- Modify: `src/app/(app)/antrenman/[date]/seans/player-data.ts` — `PlayerStats`
  drops `bestEst1RM`; add `prHistory: PRSet[]` (the frontier).
- Modify: `src/app/(app)/antrenman/[date]/seans/page.tsx` — build the frontier
  from history; pass it; remove est-1RM wiring.
- Modify: `src/app/(app)/antrenman/[date]/seans/exercise-history.tsx` — remove the
  est-1RM stat; "PR kg" stays as observed all-time top weight (rename to "En ağır").
- Modify: `use-session-player.ts` — `completeSet` uses `evaluatePR` against the
  frontier + the sets already done this session.

**Verify:** `npm test`, `npm run typecheck`, `npm run lint` green.
**Commit:** `refactor(pr): live player uses evaluatePR; remove est-1RM + tonnage`.

---

## Task 5: Session report — pure module (TDD)

**Files:**
- Create: `src/lib/reports/session-report.ts`, `src/lib/reports/session-report.test.ts`

**Shape (input is plain rows; pure):**

```ts
export type ReportSet = {
  exerciseId: string; exerciseName: string;
  weight: number | null; reps: number | null; rir: number | null;
  performedAt: string | null; createdAt: string;
  targets: { muscleSlug: string; muscleNameTr: string; functionSlug: string; functionNameTr: string; role: "primary" | "secondary" }[];
};
export type MuscleVolume = { muscleSlug: string; muscleNameTr: string; primarySets: number; secondarySets: number;
  functions: { functionSlug: string; functionNameTr: string; primarySets: number; secondarySets: number }[]; activeMs: number };
export type ExerciseDelta = { exerciseName: string; weight: "up" | "flat" | "down" | null; reps: "up" | "flat" | "down" | null;
  prCount: number; rirPrCount: number; sets: { weight: number | null; reps: number | null; prType: PRType | null }[] };
export type SessionReport = { totalSets: number; muscles: MuscleVolume[]; exercises: ExerciseDelta[]; prCount: number; rirPrCount: number };
```

**Tests (write first, run FAIL, implement, run PASS):**
- counts primary vs secondary sets per muscle and per function;
- two exercises sharing a muscle_function aggregate together (equivalent-safe);
- per-exercise weight/reps delta vs previous session (up/flat/down);
- PR + RIR-PR counts via `evaluatePR` against prior-session history;
- time distribution: sums `performed_at` gaps per muscle (fallback `created_at`),
  first set's block = 0; tolerant of nulls.

**Commit:** `feat(reports): pure session-report aggregator (TDD)`.

---

## Task 6: Plateau detector — pure module (TDD)

**Files:** `src/lib/reports/plateau.ts`, `src/lib/reports/plateau.test.ts`

```ts
export type PlateauConfig = { sessions: number };
export const PLATEAU_CONFIG: PlateauConfig = { sessions: 3 };
export type PlateauSessionStat = { date: string; topWeight: number; topReps: number; bestRir: number | null };
export function detectPlateau(stats: PlateauSessionStat[], config?: Partial<PlateauConfig>): { stalled: boolean; sessions: number };
```

**Tests:** stalled when the last N sessions show no improvement in weight OR reps
OR RIR; not stalled if any improved; not stalled with fewer than N sessions.
**Commit:** `feat(reports): plateau detector (TDD)`.

---

## Task 7: Coach weekly report — pure module (TDD)

**Files:** `src/lib/reports/coach-weekly.ts`, `src/lib/reports/coach-weekly.test.ts`

Aggregate a week of `ReportSet`-like rows (with `sessionDate`) into:
per muscle → exercises (with order-performed index from `performed_at`
first-appearance, set count, avg/median rest from same-exercise consecutive
`performed_at` gaps, RIR list/avg). Plateau flag per exercise reused from Task 6.
**Tests** for order, rest median, per-muscle grouping, equivalent aggregation.
**Commit:** `feat(reports): coach weekly aggregator (TDD)`.

---

## Task 8: Post-session report UI

**Files:**
- Modify: `src/app/(app)/antrenman/[date]/seans/session-summary.tsx` — replace the
  kg×reps "Hacim" hero with **set-count**; add muscle/function distribution block,
  up/flat/down badges (icon+word+colour), RIR-PR outline badges, approx time block.
- Modify: `session-player.tsx` / `page.tsx` — feed the server-computed
  `SessionReport` to the summary (recompute server-side on finish).
- Create (if needed): `seans/report-data.ts` — RLS-aware server reads
  (session sets + targets + prior-session history).

**Verify:** typecheck/lint; headless render per `forge-app-state` self-verify note.
**Commit:** `feat(report): muscle-based post-session summary`.

---

## Task 9: Coach weekly report UI

**Files:**
- Modify: `src/app/(app)/panel/sporcular/[athleteId]/page.tsx` — add a weekly
  report tab/section (week picker; defaults to current week).
- Create: server read for the athlete's week (coach RLS) + render via
  `coach-weekly.ts`. Forge editorial tables, mono numbers, plateau "dikkat" notes.

**Verify:** typecheck/lint; render check.
**Commit:** `feat(panel): coach weekly muscle-based report`.

---

## Task 10: Final verification + handoff

- `npm run typecheck && npm run lint && npm run test` all green.
- Summary: PR rule test output, a sample session report, how the coach weekly
  report renders, and the exact apply command for `0018`
  (Supabase MCP `apply_migration`, then regenerate `database.types.ts`).
- Do NOT apply to live DB until user says so.
**Commit (if needed):** `docs: phase 2 summary`.
