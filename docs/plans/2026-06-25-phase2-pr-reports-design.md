# Phase 2 — PR/RIR Engine + Muscle-based Reports + Plateau Detector

**Date:** 2026-06-25
**Branch:** `feat/phase2-pr-reports`
**Builds on:** Phase 1 (RIR + muscle/function taxonomy + alternatives), merge `972b31d`.

## Goal

On top of the Phase 1 data model, add a **PR engine**, a **post-session report**,
a **plateau detector**, and a **coach weekly report** — all muscle/function aware.
Do not break the existing logbook flow.

## Product philosophy (locked with user)

- **No estimated-1RM formulas** (Epley/Brzycki) anywhere — PRs are determined by
  comparing the current set to observed historical sets only.
- **"Hacim" (volume) = total SET COUNT**, never Σ(kg×reps). Existing kg×reps
  tonnage displays are removed (user: "tonajı kaldır").
- est-1RM is removed entirely from logic and UI (user: "tamamen kaldır").
- Timing accuracy via a new `log_sets.performed_at` (client-stamped).
- Turkish UI, English code/comments. Existing RLS/data flow preserved.

## 1. PR engine — exact rules

Pure function:

```ts
evaluatePR(currentSet, history, config?) => {
  isPR: boolean;
  type: "weight" | "reps" | "both" | "tradeoff" | "rir" | null;
  reference: HistorySet | null; // the prior set we beat, for UI copy
}
```

- `currentSet`: `{ weight, reps, rir }`.
- `history`: prior sets of the **same exercise**, strictly before the current set.
  In the live player this is a compact **PR frontier** (non-dominated `(weight,reps)`
  pairs + best RIR per `(weight,reps)`); `evaluatePR` works on any list.
- `config`: `PR_CONFIG`, a typed constant (future: per-coach from DB).

**Decision order:**

1. **Rule A — dominance.** If a prior `p` exists with
   `current.weight >= p.weight && current.reps >= p.reps` and at least one is
   strictly greater → **PR**.
   - `type`: weight equal & reps up → `"reps"`; reps equal & weight up →
     `"weight"`; both up → `"both"`.
   - Subsumes "same weight, more reps" and "same reps, more weight" and "both up".
2. **Rule B — trade-off (weight UP, reps DOWN).** For a prior `p` with
   `current.weight > p.weight && current.reps < p.reps`: PR iff
   `current.reps >= minMaintained(p.reps)`. If weight did not increase, Rule B
   never applies.

**`minMaintained` table (configurable):**

| reference reps | min maintained | allowed drop |
|---|---|---|
| 4 | 3 | 1 |
| 5,6,7,8,8+ | 4 | variable (5→1 … 10→6) |
| 1,2,3 | = reference (Rule B off by default) | 0 |

The 1–3 range is off by default but the coach can lower the threshold via config
to allow heavy low-rep trade-offs (user-confirmed).

**RIR PR (separate, optional).** If `current.weight == p.weight &&
current.reps == p.reps && current.rir < p.rir` (both non-null) → `type: "rir"`.
Rendered as a separate **outline** badge vs the **solid green** strength badge.
If RIR is absent, skip silently.

**Edge cases (user-confirmed):**
- Empty history → **never** a PR (first set is a baseline, not a record).
- Weight decreased → never a PR (Rule A needs reps≥ and Rule B needs weight up).

**Validation scenarios (unit tests):**
- `100×4 → 102.5×3` = PR (tradeoff); `100×4 → 102.5×2` = NOT PR.
- `100×4 → 100×5` = PR (reps); `100×4 → 102.5×4` = PR (weight).
- `100×4 → 105×5` = PR (both); `100×4 → 100×4` = NOT PR.
- `100×8 → 102.5×3` = NOT PR (drop 5 > allowed; min 4).
- RIR: `100×5 @3 → 100×5 @1` = RIR PR; weight/reps differ → not RIR PR.
- empty history → NOT PR.

## 2. Volume = set count

"Hacim" everywhere = number of sets. For muscle/function distribution a set is
counted toward each `(muscle, function, role)` its exercise targets. **Primary
sets** are the headline number; secondary sets shown lighter. Equivalents collapse
naturally because counting is by `muscle_function`, not by exercise.

## 3. Post-session report

Computed server-side from saved sets (DB = source of truth), shown to the athlete
on finish and available to the coach.

1. **Muscle/function set distribution** — grouped by muscle; primary headline,
   secondary lighter.
2. **Movement summary** — exercises, sets, reps, weights.
3. **PRs** — strength PRs (solid) + RIR PRs (outline).
4. **Up/flat/down vs previous session** — per exercise, weight & reps, with
   icon (▲/■/▼) + Turkish word + colour (colour-blind safe; never colour-only).
5. **Time distribution (approx.)** — from `performed_at` gaps. Each set's block =
   gap from the previous set (work+rest) attributed to that exercise → its
   primary muscles. Per-muscle active time, labelled "yaklaşık".

## 4. Plateau detector

`detectPlateau(exerciseSessions, config)` — over the last N sessions
(default 3, configurable): if **neither weight, reps, nor RIR** improved →
a soft "durgunluk" signal (coach-facing attention, not an alarm). Language stays
gentle. Threshold configurable; start with the simple N-session rule.

## 5. Coach weekly report

Lives as a tab/section on `/panel/sporcular/[athleteId]`. Per muscle (split out):
which exercises, **order performed** (`performed_at` first-appearance), set counts,
**rest times** (gaps between consecutive sets of the same exercise), and RIRs.
Forge editorial: tables/lists, mono numbers, calm.

## Architecture

- **Pure modules (TDD):** `src/lib/pr/evaluate-pr.ts`,
  `src/lib/reports/session-report.ts`, `src/lib/reports/plateau.ts`,
  `src/lib/reports/coach-weekly.ts` (+ `.test.ts` each).
- **Server data layer:** RLS-aware reads via existing `@supabase/ssr` client.
- **Live player:** replace `detectPr` with `evaluatePR`; pass a PR frontier from
  the server instead of `allTimePr`/`bestEst1RM`.
- **Migration `0018`:** `log_sets.performed_at timestamptz NULL`. Applied via
  Supabase MCP (matches Phase 1 apply path), client stamps it on set completion;
  legacy rows fall back to `created_at`.
- **Removals:** `brzycki()`, `bestEst1RM`, kg×reps `setsVolume`/tonnage displays.

## Out of scope (YAGNI)

- Per-coach config UI (config is a typed constant now).
- Estimated-1RM, tonnage charts.
