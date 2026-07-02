# Profile, Physique Photos & Cardio/Steps — Design

**Date:** 2026-07-02 · **Status:** approved (4 decisions locked with user)

Adds three athlete-facing modules to Forge without touching existing flows:
a real profile page (identity + measurements + preferences), physique
progress photos on private storage, and lightweight cardio/steps entry.

## Locked decisions

1. **Steps live in `daily_metrics.steps`** (new column + `metrics.ts` registry
   entry) — the tracker table, relative colouring, weekly averages, goals and
   the coach panel all work automatically. No separate steps table; a `source`
   column can be added later if HealthKit sync ever lands.
2. **Cardio UI lives on `/takip`** as a section under the weekly table,
   sharing the `?week=` navigation. No new nav destination.
3. **Unit preference is stored but the UI stays kg-only** this phase. A
   half-working lb conversion is worse than none; the field (`kg` default)
   makes the data model ready.
4. **Physique photos get their own page `/fizik`**, linked from Bugün
   ("fizik update" card) and İlerleme.

## Why a separate `profile_details` table

`profiles` is community-readable by design (`profiles_select_auth USING
(true)` — the feed needs names/avatars). Height, birth date, sex and goals
must be visible **only to the athlete and the coach**, so they go in a new
1:1 table with strict RLS instead of new `profiles` columns (RLS is row-level;
column-level hiding would need views).

## Data model (migrations 0025 structural + 0026 RLS/storage)

- `profiles` += `username text` UNIQUE, nullable, CHECK `^[a-z0-9_]{3,20}$`.
  Community-visible identity, like full_name/avatar.
- **`profile_details`** — `user_id uuid PK → profiles ON DELETE CASCADE`,
  `height_cm int CHECK 100–250`, `birth_date date`, `sex user_sex enum
  ('male','female')`, `unit weight_unit enum ('kg','lb') NOT NULL DEFAULT
  'kg'`, `goal training_goal enum ('muscle_gain','strength','fat_loss',
  'maintenance')`, `weekly_target_days int CHECK 1–7`, `updated_at`.
  All nullable except unit — everything is optional.
  RLS: SELECT owner OR `is_coach()`; INSERT/UPDATE/DELETE owner only
  (coach is read-only per spec, unlike `profiles`).
- **`physique_photos`** — `id`, `athlete_id → profiles CASCADE`,
  `photo_date date NOT NULL`, `storage_path text NOT NULL UNIQUE`,
  `note text`, `weight_kg numeric(5,2)`, `created_at`.
  Index `(athlete_id, photo_date)`. RLS: SELECT owner OR coach;
  INSERT/UPDATE/DELETE owner only (WITH CHECK `athlete_id = auth.uid()`).
- **Storage bucket `physique`** — `public = false`, 10 MB limit, image mime
  types only. `storage.objects` policies:
  - INSERT: bucket `physique` AND first path folder = `auth.uid()`
  - SELECT: bucket `physique` AND (first folder = `auth.uid()` OR `is_coach()`)
  - DELETE: same as INSERT (owner folder only); no UPDATE policy (immutable).
  Photos render via **server-side signed URLs** (1 h) minted with the user's
  own JWT client, so URL creation itself is RLS-gated.
- **`cardio_sessions`** — `id`, `athlete_id → profiles CASCADE`,
  `session_date date NOT NULL`, `activity cardio_activity enum
  ('walk','run','swim','bike','elliptical','other') NOT NULL`,
  `duration_min int NOT NULL CHECK 1–1440`, `distance_km numeric(6,2)
  CHECK 0–500`, `calories int CHECK 0–10000`, `note text`,
  `source text NOT NULL DEFAULT 'manual'` (future: `'health'`), `created_at`.
  Index `(athlete_id, session_date)`. RLS: SELECT owner OR coach; write owner.
- `daily_metrics` += `steps integer` (registry clamps 0–100 000).

Apply path: `drizzle-kit generate` for structural, hand-written SQL for
RLS/storage, both applied live via Supabase MCP `apply_migration` (never
`db:migrate`), then regenerate `database.types.ts` and confirm
`db:generate` reports no changes.

## Metric registry

`src/lib/metrics.ts` gains `steps`: label "Adım", unit null, range
[0, 100000], decimals 0, `higherBetter`, `goalAllowed: true`, spreadFloor
1000, inputMode numeric. Added to `DEFAULT_ENABLED` (headline feature,
tiny community — discoverable by default; digestion stays opt-in).

**Goal feeds weight colouring:** weight is `trend` polarity today (never
judged). When `profile_details.goal` is `fat_loss` (down = good) or
`muscle_gain` (up = good) the tracker judges the weight trend direction; for
`strength`/`maintenance`/unset it stays neutral. Pure function
`weightValence(trend, goal)` in `metrics.ts`, used by the table cells and
the weekly average card.

## UI

**/profil — editorial redesign** (Lab primitives, mobile-first, not a
generic settings form): a künye-style header (avatar, serif name,
@username, role badge, age · height meta line), then sections **Kimlik**
(ad, kullanıcı adı, hakkında, avatar), **Ölçüler** (boy, doğum tarihi,
cinsiyet), **Tercihler** (birim, hedef, haftalık antrenman günü). Saves via
server actions; upsert on `profile_details`.

**/fizik** — month-grouped photo timeline (2-col mobile grid, signed-URL
images, date + weight chip), upload dialog (date defaults today, weight
placeholder prefilled from that day's tracked weight, note), and a compare
mode: select any two photos → side-by-side before/after with dates,
weights and delta. Delete own photos (removes storage object + row).

**/takip** — new **Kardiyo** section under the table: the shown week's
entries (day, activity icon + label, duration, optional distance/kcal),
add/edit dialog, weekly total minutes in the "Bu hafta" cards. Steps appear
as a normal tracker column.

**/bugun** — "Fizik" card fed by `physique_photos`: latest photo thumb +
"son güncelleme X gün önce", stale nudge after 14 days, empty-state CTA.
"Bu hafta" card shows `completed / weekly_target_days` when the target is
set.

**Coach panel** (`/panel/sporcular/[athleteId]`) — read-only profile
summary (goal, weekly target, height, age), recent physique thumbs linking
to a coach-scoped fizik view, recent cardio list. Steps arrive free via the
existing daily-metrics table.

## Code structure

- `src/lib/profile/consts.ts` — goal/sex/unit defs with Turkish labels;
  `age()` pure fn; username validation (shared client/server).
- `src/lib/cardio/` — activity defs (labels, icons), weekly summary pure fn.
- `src/lib/physique/` — signed-URL helper, staleness calc.
- `src/components/physique/` — photo grid, upload, compare view (shared
  athlete/coach).
- Routes: `/fizik` (+ actions), `/panel/sporcular/[athleteId]/fizik`;
  `/takip` cardio section + actions; `/profil` rebuilt forms + actions.

## Testing & verification

- vitest (TDD) for pure logic: steps metric behaviour, `weightValence`,
  cardio weekly summary, age calc, username validation.
- RLS verified live by JWT simulation (like Phase 3): second athlete sees
  zero foreign rows in `profile_details`/`physique_photos`/`cardio_sessions`
  and zero foreign `physique` storage objects; coach reads but cannot write
  `profile_details`; cross-folder storage INSERT blocked.
- `npm run build` / `lint` / `typecheck` / `test`; headless-Chrome
  screenshots for the visual pass; manual test scenario doc at the end.
