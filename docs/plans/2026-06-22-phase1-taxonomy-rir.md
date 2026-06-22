# Phase 1 — Data Model Foundation: RIR + Exercise Taxonomy + Alternatives

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace RPE with RIR everywhere and build the exercise taxonomy backbone
(muscles → muscle functions → exercise targets, movement pattern, equipment,
ownership) plus an alternatives model — schema, migrations, RLS, reference seed,
and an editable CSV import path — without breaking existing UI/flows.

**Architecture:** Drizzle defines table structure (`src/db/schema.ts`); RLS,
helper functions, and reference-data seeds live in hand-authored numbered SQL
migrations under `drizzle/` (pattern: `0001_security.sql`, `0009_library_rls.sql`).
Reference data (muscles, muscle functions) ships as an idempotent SQL migration so
FKs resolve in every environment. System exercises + their muscle targets ship as
an editable CSV (`scripts/exercise-taxonomy.csv`) imported by a service-role TS
script (mirrors `src/db/seed.ts`). Alternatives are a manual junction table plus a
Postgres function that auto-suggests by `movement_pattern` + shared primary target.

**Tech Stack:** Next.js 15, Drizzle ORM 0.45, drizzle-kit 0.31, Supabase
(postgres + RLS), Zod, Vitest, tsx.

**Decisions (locked with user):**
- movement_pattern & equipment_type: `pgEnum` + Turkish labels as a code map.
- Reference data via SQL migration; exercises/targets via editable CSV + import.
- Auto-suggest alternatives as a Postgres function (RLS = invoker).
- Targets reference `muscle_function_id` only (muscle derived via FK).
- Stable `slug`s on muscles/functions/exercises so the CSV references by slug.
- Manual alternatives stored as a single row; lookups treat both directions (symmetric).
- RIR is `numeric(3,1)`, always nullable, `CHECK (0..10)`. No RPE→RIR data conversion (no prod data).
- Branch: `feat/phase1-taxonomy-rir`. Generate migrations + verify; DO NOT apply to live DB until user says so.

---

## Task 1: RIR rename — schema

**Files:** Modify `src/db/schema.ts`

**Step 1:** In `logSets`, rename column `rpe` → `rir`:
`rir: numeric("rir", { precision: 3, scale: 1 })`. In `workoutExercises`,
`targetRpe`/`target_rpe` → `targetRir`/`target_rir`.

**Step 2:** Add `check` import from `drizzle-orm/pg-core` and add CHECK constraints
in each table's config callback:
- `logSets`: `check("log_sets_rir_range", sql\`${t.rir} IS NULL OR (${t.rir} >= 0 AND ${t.rir} <= 10)\`)`
- `workoutExercises`: `check("workout_exercises_target_rir_range", sql\`${t.targetRir} IS NULL OR (${t.targetRir} >= 0 AND ${t.targetRir} <= 10)\`)`

**Step 3:** `npm run typecheck` — expect errors only in app files still using `rpe` (fixed in Task 2).

---

## Task 2: RIR rename — app code sweep

**Files (modify):** every file from the grep sweep:
- `src/app/(app)/panel/programlar/actions.ts` — `targetRpe`→`targetRir`, `target_rpe`→`target_rir`
- `src/app/(app)/panel/programlar/[programId]/page.tsx` — `target_rpe`; label `RPE {..}` → `RIR {..}`
- `src/app/(app)/panel/programlar/[programId]/workout-exercise-dialog.tsx` — input id/name/label `targetRpe`→`targetRir`, label text `RPE`→`RIR`, helper text mentions RIR
- `src/app/(app)/panel/sporcular/[athleteId]/page.tsx` — select string `rpe`→`rir`
- `src/app/(app)/antrenman/[date]/seans/page.tsx` — select string `rpe`→`rir`, `target_rpe`→`target_rir`, `avgRpe4w`→`avgRir4w`
- `src/app/(app)/antrenman/[date]/seans/session-player.tsx` — `target.rpe`→`target.rir`, label `RPE`→`RIR`, `s.rpe`→`s.rir`, prop `targetRpe`→`targetRir`
- `src/app/(app)/antrenman/[date]/seans/set-input.tsx` — full rename incl. state `rpe/setRpe/showRpe`→`rir/setRir/showRir`, label/aria `RPE`→`RIR`, helper "RIR" + tooltip
- `src/app/(app)/antrenman/[date]/seans/use-session-player.ts` — field `rpe`→`rir`
- `src/app/(app)/antrenman/[date]/seans/exercise-history.tsx` — `avgRpe4w`→`avgRir4w`, label `RPE·4h`→`RIR·4h`
- `src/app/(app)/antrenman/[date]/seans/player-data.ts` — `avgRpe4w`→`avgRir4w`
- `src/app/(app)/antrenman/[date]/seans/actions.ts` — zod `rpe`→`rir` (`.nullable()`, add `.min(0).max(10)`), payload `rpe`→`rir`
- `src/components/logbook/session-view.tsx` — `rpe`→`rir`, `@{rpe}` display stays as `@{rir}`
- `src/lib/logbook-stats.ts` — `rpe`→`rir`, `avgRpe`→`avgRir`, `setsAvgRpe`→`setsAvgRir`, `avgRpe4w`→`avgRir4w`, doc comments
- `src/lib/session/types.ts` — `rpe`→`rir`
- `src/lib/session/reducer.ts` — `rpe`→`rir`
- `src/lib/session/sync-queue.ts` — `rpe`→`rir`
- `src/db/seed.ts` — any `rpe`/`target_rpe` in demo program
- `scripts/seed-demo-athlete.ts` — `rpe`→`rir`
- `scripts/seed-insight-rules.ts` — metric keys referencing rpe (check; rename metric `rpe`→`rir` if present)
- `src/lib/rag/insights-server.ts` & `insights.test.ts` — rpe metric references

**Tests (modify):** `src/lib/logbook-stats.test.ts`, `src/lib/session/reducer.test.ts`,
`src/lib/session/totals.test.ts`, `src/lib/session/sync-queue.test.ts`,
`src/lib/rag/insights.test.ts` — rename fields/labels.

**Tooltip/help text (Turkish):** wherever RIR is first shown to the athlete/coach,
include: `RIR = Yedekte kalan tekrar (0 = tam başarısızlık)`.

**database.types.ts:** `src/lib/database.types.ts` — rename `rpe`→`rir`,
`target_rpe`→`target_rir` in `log_sets` and `workout_exercises` Row/Insert/Update.
(Will be regenerated from Supabase types after migration is applied; hand-edit now so typecheck passes.)

**Verify:** `npm run typecheck` clean; `npm run lint`; `npm run test` green.
`grep -rniE "\brpe\b" src scripts` returns nothing meaningful.

**Commit:** `refactor(rir): replace RPE with RIR across schema, types and UI`

---

## Task 3: Taxonomy schema (enums + tables + exercise enrichment)

**Files:** Modify `src/db/schema.ts`

**Step 1 — enums:**
```ts
export const movementPattern = pgEnum("movement_pattern", [
  "push_horizontal","push_vertical","pull_horizontal","pull_vertical",
  "squat","hinge","lunge","isolation","carry","core","rotation",
]);
export const equipmentType = pgEnum("equipment_type", [
  "barbell","dumbbell","machine","cable","bodyweight","kettlebell",
  "band","smith","ez_bar","trap_bar","other",
]);
export const muscleRegion = pgEnum("muscle_region", ["upper","lower","core"]);
export const exerciseMuscleRole = pgEnum("exercise_muscle_role", ["primary","secondary"]);
```

**Step 2 — exercises enrichment** (add to existing table, keep `category` for legacy display):
```ts
slug: text("slug"),
movementPattern: movementPattern("movement_pattern"),
equipmentType: equipmentType("equipment_type"),
isSystem: boolean("is_system").notNull().default(false),
```
Add `unique("exercises_slug_key").on(t.slug)` and
`index("exercises_pattern_idx").on(t.movementPattern)`.

**Step 3 — muscles:**
```ts
export const muscles = pgTable("muscles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull(),
  nameTr: text("name_tr").notNull(),
  nameLatin: text("name_latin"),
  region: muscleRegion("region").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("muscles_slug_key").on(t.slug)]);
```

**Step 4 — muscle_functions:**
```ts
export const muscleFunctions = pgTable("muscle_functions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  muscleId: uuid("muscle_id").notNull().references(() => muscles.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  nameTr: text("name_tr").notNull(),
  nameTechnical: text("name_technical"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("muscle_functions_slug_key").on(t.slug), index("muscle_functions_muscle_idx").on(t.muscleId)]);
```

**Step 5 — exercise_muscle_targets:**
```ts
export const exerciseMuscleTargets = pgTable("exercise_muscle_targets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  muscleFunctionId: uuid("muscle_function_id").notNull().references(() => muscleFunctions.id, { onDelete: "restrict" }),
  role: exerciseMuscleRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("exercise_muscle_targets_unique").on(t.exerciseId, t.muscleFunctionId),
  index("exercise_muscle_targets_exercise_idx").on(t.exerciseId),
  index("exercise_muscle_targets_function_idx").on(t.muscleFunctionId),
]);
```

**Step 6 — exercise_alternatives:**
```ts
export const exerciseAlternatives = pgTable("exercise_alternatives", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  alternativeId: uuid("alternative_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  note: text("note"),
  createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("exercise_alternatives_unique").on(t.exerciseId, t.alternativeId),
  check("exercise_alternatives_distinct", sql`${t.exerciseId} <> ${t.alternativeId}`),
  index("exercise_alternatives_exercise_idx").on(t.exerciseId),
]);
```

**Verify:** `npm run typecheck` clean.

---

## Task 4: Generate structural migration (0013)

**Run:** `npm run db:generate` (drizzle-kit generate; writes the SQL + journal + meta snapshot; does NOT touch the DB).

**If drizzle-kit prompts about rpe→rir rename in a TTY-less shell:** it defaults to
drop+create, which is fine (no data). Inspect the produced `drizzle/0013_*.sql`:
- new enums created
- `exercises` gains slug/movement_pattern/equipment_type/is_system + unique/index
- `log_sets`: rpe dropped / rir added (or renamed) + check
- `workout_exercises`: target_rpe→target_rir + check
- new tables muscles, muscle_functions, exercise_muscle_targets, exercise_alternatives

**Commit:** `feat(db): structural migration for taxonomy + RIR (0013)`

---

## Task 5: RLS + suggest function migration (0014, hand-authored)

**Files:** Create `drizzle/0014_taxonomy_rls.sql`; append journal entry to
`drizzle/meta/_journal.json`; create `drizzle/meta/0014_snapshot.json` (copy of
`0013_snapshot.json` with a fresh `id` and `prevId` = 0013's id — no structural change).

**SQL contents:**
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for muscles, muscle_functions, exercise_muscle_targets, exercise_alternatives.
2. Reference reads (all authenticated), coach writes (`public.is_coach()`):
   - muscles, muscle_functions: `SELECT USING (true)`, `FOR ALL USING/WITH CHECK (public.is_coach())`.
3. **Replace** the existing `exercises_select_auth` policy:
   ```sql
   DROP POLICY IF EXISTS "exercises_select_auth" ON public.exercises;
   CREATE POLICY "exercises_select_visible" ON public.exercises
     FOR SELECT TO authenticated USING (is_system = true OR created_by = auth.uid());
   -- keep coach write; add owner-manage-own (non-system)
   CREATE POLICY "exercises_owner_write" ON public.exercises
     FOR ALL TO authenticated
     USING (created_by = auth.uid() AND is_system = false)
     WITH CHECK (created_by = auth.uid() AND is_system = false);
   ```
4. exercise_muscle_targets / exercise_alternatives SELECT scoped to a visible base exercise:
   ```sql
   CREATE POLICY "emt_select" ON public.exercise_muscle_targets FOR SELECT TO authenticated
     USING (EXISTS (SELECT 1 FROM public.exercises e WHERE e.id = exercise_id AND (e.is_system OR e.created_by = auth.uid())));
   CREATE POLICY "emt_coach_write" ON public.exercise_muscle_targets FOR ALL TO authenticated
     USING (public.is_coach()) WITH CHECK (public.is_coach());
   ```
   (same shape for exercise_alternatives)
5. `public.suggest_exercise_alternatives(p_exercise uuid)` — SECURITY INVOKER (default), STABLE:
   ```sql
   CREATE OR REPLACE FUNCTION public.suggest_exercise_alternatives(p_exercise uuid)
   RETURNS TABLE (exercise_id uuid, name text, shared_primary int, shared_secondary int)
   LANGUAGE sql STABLE AS $$
     WITH base AS (
       SELECT e.movement_pattern AS mp FROM public.exercises e WHERE e.id = p_exercise
     ),
     base_primary AS (
       SELECT muscle_function_id FROM public.exercise_muscle_targets
       WHERE exercise_id = p_exercise AND role = 'primary'
     )
     SELECT e.id, e.name,
       COUNT(*) FILTER (WHERE t.role = 'primary')::int   AS shared_primary,
       COUNT(*) FILTER (WHERE t.role = 'secondary')::int AS shared_secondary
     FROM public.exercises e
     JOIN public.exercise_muscle_targets t ON t.exercise_id = e.id
     JOIN base ON true
     WHERE e.id <> p_exercise
       AND e.movement_pattern IS NOT NULL
       AND e.movement_pattern = base.mp
       AND t.muscle_function_id IN (SELECT muscle_function_id FROM base_primary)
     GROUP BY e.id, e.name
     HAVING COUNT(*) FILTER (WHERE t.role = 'primary') > 0
     ORDER BY shared_primary DESC, shared_secondary DESC, e.name;
   $$;
   ```

**Verify (when DB applied):** `SELECT * FROM suggest_exercise_alternatives('<lat-pulldown id>');`
should return other vertical pulls sharing lat adduction, not Barbell Row (different pattern).

**Commit:** `feat(db): RLS + suggest_exercise_alternatives (0014)`

---

## Task 6: Reference-data seed migration (0015, hand-authored)

**Files:** Create `drizzle/0015_taxonomy_seed.sql`; journal entry; `0015_snapshot.json`
(copy 0014 snapshot, fresh id, prevId = 0014 id).

**Contents:** idempotent inserts of muscles then muscle_functions:
```sql
INSERT INTO public.muscles (slug, name_tr, name_latin, region) VALUES
  ('chest','Göğüs (büyük)','Pectoralis major','upper'),
  ('lat','Sırt kanat (Lat)','Latissimus dorsi','upper'),
  ... -- full list below
ON CONFLICT (slug) DO UPDATE SET name_tr = EXCLUDED.name_tr, name_latin = EXCLUDED.name_latin, region = EXCLUDED.region;

INSERT INTO public.muscle_functions (muscle_id, slug, name_tr, name_technical)
SELECT m.id, v.slug, v.name_tr, v.name_technical FROM (VALUES
  ('chest','chest-horizontal-adduction','Yatay addüksiyon','Shoulder horizontal adduction'),
  ... -- full list below
) AS v(muscle_slug, slug, name_tr, name_technical)
JOIN public.muscles m ON m.slug = v.muscle_slug
ON CONFLICT (slug) DO UPDATE SET name_tr = EXCLUDED.name_tr, name_technical = EXCLUDED.name_technical;
```

**Muscle list (slug | name_tr | name_latin | region):** chest, lat, traps-upper,
traps-mid, traps-lower, rhomboids, rear-delt, side-delt, front-delt, biceps,
brachialis, triceps, forearm-flexors, quads, hamstrings, glutes, glute-med,
calves, soleus, adductors, hip-flexors, abs, obliques, erectors.

**Function list (muscle → functions):** chest→{horizontal-adduction, shoulder-flexion};
lat→{shoulder-extension, shoulder-adduction}; traps-upper→elevation;
traps-mid→retraction; traps-lower→depression; rhomboids→retraction;
rear-delt→horizontal-abduction; side-delt→abduction; front-delt→shoulder-flexion;
biceps→elbow-flexion; brachialis→elbow-flexion; triceps→elbow-extension;
forearm-flexors→wrist-flexion; quads→knee-extension;
hamstrings→{knee-flexion, hip-extension}; glutes→hip-extension;
glute-med→hip-abduction; calves→plantarflexion; soleus→plantarflexion-knee-flexed;
adductors→hip-adduction; hip-flexors→hip-flexion; abs→trunk-flexion;
obliques→{rotation, lateral-flexion}; erectors→{spinal-extension, anti-flexion}.

**Commit:** `feat(db): seed muscles + muscle functions reference data (0015)`

---

## Task 7: Editable CSV template + valid-slug reference

**Files:** Create `scripts/exercise-taxonomy.csv`, `scripts/exercise-taxonomy.README.md`.

**CSV header:**
`slug,name,movement_pattern,equipment_type,primary_functions,secondary_functions,alternative_slugs,category,description,video_url`
- `primary_functions` / `secondary_functions`: `;`-separated muscle_function slugs.
- `alternative_slugs`: `;`-separated exercise slugs (manual alternatives).
- Prefill ~40–60 common exercises (squat/bench/deadlift/OHP/rows/pulldowns/curls/
  pushdowns/leg press/RDL/hip thrust/lateral raise/etc.) with patterns + targets filled.

**README:** lists every valid `movement_pattern`, `equipment_type`, and
`muscle_function` slug (the menu the user picks from when filling rows).

**Commit:** `docs(seed): editable exercise taxonomy CSV + slug reference`

---

## Task 8: CSV import script (TDD the pure mapper)

**Files:** Create `scripts/import-exercise-taxonomy.ts`, `scripts/lib/parse-taxonomy-csv.ts`,
`scripts/lib/parse-taxonomy-csv.test.ts`. Add npm script `"seed:taxonomy": "tsx scripts/import-exercise-taxonomy.ts"`.

**Step 1 (test first):** `parse-taxonomy-csv.test.ts`
- parses a 1-row CSV into `{ slug, name, movementPattern, equipmentType, primary: string[], secondary: string[], alternatives: string[], category, description, videoUrl }`
- splits `;` lists, trims, drops empties
- rejects unknown movement_pattern / equipment_type with a clear error
- rejects a row whose primary list is empty

**Step 2:** Run `npm test -- parse-taxonomy-csv` → FAIL.

**Step 3:** Implement `parseTaxonomyCsv(text, { validPatterns, validEquipment })`.
Minimal CSV parsing (no quoted-comma support needed unless a field needs it; if so,
handle simple double-quote escaping).

**Step 4:** Run test → PASS.

**Step 5 — importer** (`import-exercise-taxonomy.ts`, service-role client like `src/db/seed.ts`):
1. Load valid pattern/equipment from a shared const; load muscle_function slug→id map from DB.
2. For each parsed row: upsert `exercises` by `slug` (`is_system = true`); resolve function slugs → ids (error on unknown); replace that exercise's `exercise_muscle_targets`; upsert alternatives (resolve alt slugs → ids; insert single direction, skip self/dupes).
3. Idempotent + re-runnable; summary log (created/updated/targets/alts).

**Verify:** `npm test` green. (Live import deferred to user-applied DB.)

**Commit:** `feat(seed): CSV→DB exercise taxonomy importer + parser tests`

---

## Task 9: Final verification + handoff

- `npm run typecheck && npm run lint && npm run test` all green.
- `git log --oneline` shows the task commits on `feat/phase1-taxonomy-rir`.
- Write summary: ER diagram (text), CSV path, how to run seed/import, and the
  exact apply commands the user runs when ready
  (`npm run db:migrate` OR Supabase MCP `apply_migration`, then `npm run seed:taxonomy`).
- Do NOT apply to live DB (user gated).

**Final commit (if needed):** `docs: phase 1 taxonomy/RIR summary`
