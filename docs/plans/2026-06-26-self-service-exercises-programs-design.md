# Self-service exercises & programs — design

**Date:** 2026-06-26
**Branch:** `feat/self-service-exercises-programs`
**Builds on:** Phase 1 taxonomy (muscles / muscle_functions / exercise_muscle_targets /
exercise_alternatives + `suggest_exercise_alternatives()`), Phase 2 reports.

## Goal

Let **both coaches and athletes** define their own exercises (with the full Phase 1
taxonomy) and let **athletes** build their own training programs and schedule them onto
their own calendar — reusing the coach's existing program/workout plumbing, gated by RLS
so personal data stays private. Coach keeps read-only oversight of athlete-owned data.

The coach's current exercise form does **not** capture the taxonomy (it only fed in via the
CSV importer). We close that gap by upgrading to **one shared rich form** used by both roles.

## Locked decisions (with the user)

1. **One shared rich exercise form** — upgrade the coach form too; coach exercises become
   taxonomy-rich and therefore visible to the alternatives/report engine.
2. **Separate "Programlarım" area** for athletes; `/programlar` stays community discovery.
3. **Muadil** in the program-writing flow now; in-session swap deferred to a later step.
4. **Coach is read-only** on athlete-owned programs/exercises.

## Visibility model

- **System / community exercise** = `is_system = true` (the 100 seeded + any coach-created).
  Visible to everyone. Coach-created exercises are `is_system = true`.
- **Personal exercise** = `is_system = false`, `created_by = athlete`. Owner + coach only.
- **Community program** = coach-authored, `is_published = true`. Browsed & enrolled at
  `/programlar`.
- **Personal program** = athlete-authored, always `is_published = false`. Owner + coach
  (read-only) only. Built & scheduled at `/programlarim`.

## A. RLS migration `drizzle/0019_self_service_rls.sql` (no structural change; applied live via Supabase MCP)

Verified safe against live data: programs(2)/workouts(4) all have `created_by` set on a coach;
the 100 null-owner exercises are `is_system = true` (managed by coach via `is_coach()`), so
exercise write policies are **left untouched**.

1. **`exercise_muscle_targets`** — add `emt_owner_write` (FOR ALL): owner of a non-system
   exercise may write its targets. `emt_coach_write` stays. Mirrors `exercises_owner_write`.
2. **`programs`** — `programs_select` gains `OR created_by = auth.uid()`. Replace
   `programs_coach_write` with ownership-based `programs_write` (FOR ALL):
   `USING (created_by = auth.uid())`,
   `WITH CHECK (created_by = auth.uid() AND (public.is_coach() OR is_published = false))`.
   → coach writes own (community) programs; athletes write own and can never community-publish;
   coach is read-only on athlete programs (different `created_by`).
3. **`workouts` / `workout_exercises`** — SELECT inherits parent-program visibility via
   `EXISTS (... programs/workouts ...)`; write inherits program ownership. Replaces the
   open `*_select_auth (true)` and `*_coach_write` policies. Hides personal-program content
   from other athletes.
4. **`calendar_assignments`** — add `calendar_owner_write` (FOR ALL):
   `athlete_id = auth.uid() AND created_by = auth.uid()` and the referenced program is owned
   by the user. `calendar_coach_write` stays. Athletes schedule only their own program for
   themselves; existing bugun/takvim/antrenman pipeline consumes these unchanged.

## B. Shared components (no duplication)

- `components/exercises/muscle-target-picker.tsx` — client. Muscle (grouped by region) →
  function (of that muscle) → role (primary/secondary). Added targets shown as removable
  chips; serialized to a hidden `targets` JSON field. Mobile-friendly Radix selects.
- `components/exercises/exercise-form.tsx` — client Dialog. Fields: name, movement_pattern,
  equipment_type, region (optional), description, video_url + the picker. Takes a
  `create`/`update` action pair and an optional existing exercise (+ its targets). Used by
  coach and athlete.
- `lib/exercise-targets.ts` — **pure** parse/validate/dedup of the `targets` payload (TDD).
- `components/programs/` — shared program builder UI (`program-dialog`, `workout-dialog`,
  `workout-exercise-dialog` with the upgraded **ExercisePicker**, and the program detail
  list), parameterized by an `actions` object + `basePath`. The coach page keeps its current
  behavior by rendering these with the coach action set + `basePath="/panel/programlar"`.
- **ExercisePicker** — system + own exercises in one grouped list, "Özel" badge for
  `is_system = false`, and a **"Muadil göster"** action → `suggestAlternatives(exerciseId)`
  server action wrapping `suggest_exercise_alternatives()` (RLS-aware). Picking a suggestion
  fills the exercise field; muscle/function tracking stays continuous.

## C. New athlete surfaces

- `/egzersizlerim` (+ `actions.ts`) — list the athlete's own exercises, create/edit via the
  shared form (action sets `is_system = false`, `created_by = self`, writes targets).
- `/programlarim` (+ `[programId]` + `actions.ts`) — list + build personal programs via the
  shared builder; each exercise gets target sets/reps/weight/RIR/rest/notes. A "Takvime ata"
  dialog inserts a personal `calendar_assignment` (workout + date) for the athlete.
- Nav: athlete secondary nav gains "Programlarım" + "Egzersizlerim".

## D. Testing

- **TDD (vitest)** for `lib/exercise-targets.ts` (parse/validate/dedup) and any other pure
  helper extracted.
- `npm run test` + `npm run typecheck` + `npm run lint` + `npm run build` green.
- Final manual scenario: athlete defines a custom exercise (muscle+function targets) →
  builds a personal program using a system + the custom exercise → checks a muadil →
  schedules it on their calendar → sees it on `/bugun`; coach sees it read-only.

## Out of scope (this phase)

- In-session (session player) muadil swap.
- Media upload for exercise video/image (field only).
- Coach-curated manual `exercise_alternatives` editing UI (auto-suggestions only).
