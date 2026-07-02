# Profile + Physique Photos + Cardio/Steps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Athlete profile (identity + private measurements + preferences), physique progress photos on private storage with compare view, and lightweight cardio/steps entry — per `docs/plans/2026-07-02-profile-physique-cardio-design.md`.

**Architecture:** Drizzle owns schema (generated 0025) + hand-written RLS/storage SQL (0026); both applied live via Supabase MCP `apply_migration` (NEVER `db:migrate`). All app queries via `@supabase/ssr` user-JWT clients so RLS is authoritative. Steps ride the existing tracker metric registry; cardio is a new table surfaced on /takip; physique photos live in a private bucket rendered through server-minted signed URLs.

**Tech stack:** Next 15.5 App Router (async `params`/`searchParams`, server actions, `useActionState`), Supabase (Postgres RLS + Storage), drizzle-kit generate, zod, vitest, Lab design primitives (`src/components/lab/lab.tsx`), Turkish UI / English code.

**House rules (from codebase reading, follow exactly):**
- Numeric DB values arrive as strings — use `formatNumber` / `Number()` guards.
- Server actions: `"use server"`, zod parse, `requireProfile()`, return `{ ok?, error? }` or void, `revalidatePath`.
- Client forms: `useActionState` + sonner toasts + `SubmitButton`.
- Athlete pages use `LabPage/LabHeader/PaperCard/SectionLabel/MarginNote`; coach panel uses plain sections with `h2` label style (see `panel/sporcular/[athleteId]/page.tsx`).
- Icons via `lucide-react`. Dates via `date-fns` + `toDateKey`/`formatDate` from `@/lib/format`.
- Commit after every green step; branch `feat/profile-physique-cardio`.

---

### Task 1: Schema additions + structural migration 0025

**Files:**
- Modify: `src/db/schema.ts`
- Generate: `drizzle/0025_*.sql` + `drizzle/meta/*`

**Step 1: Add enums near the other pgEnums (top of schema.ts):**

```ts
export const userSex = pgEnum("user_sex", ["male", "female"]);
export const weightUnit = pgEnum("weight_unit", ["kg", "lb"]);
export const trainingGoal = pgEnum("training_goal", [
  "muscle_gain",
  "strength",
  "fat_loss",
  "maintenance",
]);
export const cardioActivity = pgEnum("cardio_activity", [
  "walk",
  "run",
  "swim",
  "bike",
  "elliptical",
  "other",
]);
```

**Step 2: `profiles` gains a community-visible unique handle:**

```ts
// inside profiles pgTable, after fullName:
username: text("username"),
```
and convert `profiles` to the `(t) => [unique(...)]` form:
```ts
(t) => [unique("profiles_username_key").on(t.username)],
```
(Format CHECK for username lives in 0026 — RLS-style hand SQL, like other constraints outside the snapshot.)

**Step 3: New tables (place after `trackerSettings`, new section comment):**

```ts
/* -------------------------------------------------------------------------- */
/*  Profile details, physique photos & cardio                                 */
/* -------------------------------------------------------------------------- */

/**
 * Private per-user profile data. Separate from `profiles` on purpose:
 * `profiles` is community-readable (feed needs names/avatars) while these
 * fields are visible only to the owner and the coach (RLS in 0026).
 */
export const profileDetails = pgTable("profile_details", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  heightCm: integer("height_cm"),
  birthDate: date("birth_date"),
  sex: userSex("sex"),
  // Stored now, UI stays kg-only this phase (design decision #3).
  unit: weightUnit("unit").notNull().default("kg"),
  goal: trainingGoal("goal"),
  weeklyTargetDays: integer("weekly_target_days"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Physique progress photos. The image lives in the private `physique` storage
 * bucket under `{athlete_id}/{uuid}.{ext}`; this row is the metadata. Highly
 * sensitive: RLS + storage policies restrict to owner + coach (0026).
 */
export const physiquePhotos = pgTable(
  "physique_photos",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    photoDate: date("photo_date").notNull(),
    storagePath: text("storage_path").notNull(),
    note: text("note"),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("physique_photos_storage_path_key").on(t.storagePath),
    index("physique_photos_athlete_date_idx").on(t.athleteId, t.photoDate),
  ],
);

/**
 * Free-form cardio entries, deliberately outside the workout-logging flow.
 * `source` future-proofs for HealthKit-style sync (always 'manual' today).
 */
export const cardioSessions = pgTable(
  "cardio_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    sessionDate: date("session_date").notNull(),
    activity: cardioActivity("activity").notNull(),
    durationMin: integer("duration_min").notNull(),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    calories: integer("calories"),
    note: text("note"),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("cardio_sessions_athlete_date_idx").on(t.athleteId, t.sessionDate)],
);
```

**Step 4: `dailyMetrics` gains steps (after `waterMl`):**

```ts
steps: integer("steps"),
```

**Step 5: Generate migration.** Run `npm run db:generate:auto` (drizzle-kit needs a TTY; the expect wrapper answers rename prompts with the default). Inspect the new `drizzle/0025_*.sql`: must contain 4 `CREATE TYPE`, 3 `CREATE TABLE`, `ALTER TABLE "profiles" ADD COLUMN "username"` + unique, `ALTER TABLE "daily_metrics" ADD COLUMN "steps" integer`, FKs and the index. **No DROP of anything.** If drizzle proposes drops, abort and fix schema.ts.

**Step 6: Commit** `feat(db): profile details, physique photos, cardio + steps schema`.

---

### Task 2: RLS + storage migration 0026 (hand-written)

**Files:**
- Create: `drizzle/0026_profile_physique_cardio_rls.sql`

Full content (idempotent, mirrors 0004/0024 style):

```sql
-- RLS + storage for profile_details, physique_photos, cardio_sessions.
-- profile_details/cardio: athlete owns row, coach read-only (like daily_metrics 0004).
-- physique_photos: SENSITIVE — owner + coach only, storage bucket is private
-- and every object path starts with the owner's uid.

-- 1. Username format guard (unique index comes from 0025).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

-- 2. profile_details
ALTER TABLE public.profile_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_details_select" ON public.profile_details
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_coach());
CREATE POLICY "profile_details_insert" ON public.profile_details
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "profile_details_update" ON public.profile_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "profile_details_delete" ON public.profile_details
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. physique_photos (rows)
ALTER TABLE public.physique_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "physique_photos_select" ON public.physique_photos
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "physique_photos_insert" ON public.physique_photos
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "physique_photos_update" ON public.physique_photos
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "physique_photos_delete" ON public.physique_photos
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());

-- 4. cardio_sessions
ALTER TABLE public.cardio_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cardio_sessions_select" ON public.cardio_sessions
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "cardio_sessions_insert" ON public.cardio_sessions
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "cardio_sessions_update" ON public.cardio_sessions
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "cardio_sessions_delete" ON public.cardio_sessions
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());

-- 5. Private storage bucket for physique photos. iOS converts HEIC to JPEG on
-- web upload, so the browser-displayable trio is enough.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('physique', 'physique', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 6. Object policies: writes only inside your own top-level folder; reads for
-- the owner folder or the coach. No UPDATE policy — objects are immutable.
DROP POLICY IF EXISTS "physique_insert_own" ON storage.objects;
CREATE POLICY "physique_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'physique'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "physique_select_own_or_coach" ON storage.objects;
CREATE POLICY "physique_select_own_or_coach" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'physique'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_coach())
  );

DROP POLICY IF EXISTS "physique_delete_own" ON storage.objects;
CREATE POLICY "physique_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'physique'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Commit: `feat(db): RLS + private physique storage policies (0026)`.

---

### Task 3: Apply live via Supabase MCP + regenerate types

Target project **`gscwjsqsklqpinrymtqe`** (Frankfurt), per memory — never the old Tokyo ref.

1. `mcp__supabase__apply_migration` name `profile_physique_cardio_schema`, query = contents of `drizzle/0025_*.sql`.
2. `mcp__supabase__apply_migration` name `profile_physique_cardio_rls`, query = contents of 0026.
3. Verify: `list_tables` shows the 3 new tables with `rls_enabled: true`; `execute_sql` → `select id, public from storage.buckets where id='physique'` returns `public=false`.
4. `mcp__supabase__generate_typescript_types` → overwrite `src/lib/database.types.ts`.
5. Run `npx drizzle-kit generate` (expect "No schema changes").
6. Add to `src/lib/types.ts`:
   ```ts
   export type ProfileDetails = Tables<"profile_details">;
   export type PhysiquePhoto = Tables<"physique_photos">;
   export type CardioSession = Tables<"cardio_sessions">;
   ```
7. `npm run typecheck` green. Commit `feat(db): apply live + regen types`.

---

### Task 4: Steps metric end-to-end (TDD)

**Files:**
- Modify: `src/lib/metrics.ts`, `src/lib/metrics.test.ts`
- Modify: `src/app/(app)/takip/metric-row.tsx` (ALL_KEYS/FIELD/CELL_WIDTH maps)
- Modify: `src/app/(app)/takip/actions.ts` (schema + upsert)
- Modify: `src/app/(app)/takip/page.tsx` (`formatAvg` whole-number for steps)
- Modify: `src/app/(app)/panel/sporcular/[athleteId]/page.tsx` (Adım column)

**Step 1: Failing tests** (extend metrics.test.ts):
```ts
it("registers steps as a higher-better goalable integer metric", () => {
  const def = getMetric("steps");
  expect(def.polarity).toBe("higherBetter");
  expect(def.goalAllowed).toBe(true);
  expect(def.range).toEqual([0, 100000]);
  expect(def.decimals).toBe(0);
});
it("includes steps in the default column set", () => {
  expect(DEFAULT_ENABLED).toContain("steps");
});
it("keeps steps in resolveEnabled round-trips", () => {
  expect(resolveEnabled(["steps", "weight"])).toEqual(["weight", "steps"]);
});
```
Run `npm run test -- metrics` → FAIL (unknown metric).

**Step 2: Implement.** In `metrics.ts`: add `"steps"` to `MetricKey`; registry entry between `digestion` and `notes`:
```ts
{
  key: "steps",
  label: "Adım",
  short: "Adım",
  unit: null,
  range: [0, 100000],
  decimals: 0,
  polarity: "higherBetter",
  goalAllowed: true,
  spreadFloor: 1000,
  inputMode: "numeric",
},
```
Add `"steps"` to `DEFAULT_ENABLED` (before `"notes"`; update the doc comment — steps is default-on as a headline feature, digestion stays opt-in). Tests pass.

**Step 3: Wire the tracker plumbing** (all mechanical, registry-driven):
- `metric-row.tsx`: add `"steps"` to `ALL_KEYS` (before notes), `FIELD` (`steps: "steps"`), `CELL_WIDTH` (`steps: "w-16"`).
- `takip/actions.ts`: `steps: num(100000)` in schema; parse `steps: formData.get("steps")`; upsert `steps: d.steps == null ? null : Math.round(d.steps)`.
- `takip/page.tsx` `formatAvg`: whole numbers for `resting_hr` **and** `steps`.
- Panel athlete page daily-metrics table: `<th>Adım</th>` after Sindirim + `<td>{m.steps?.toLocaleString("tr-TR") ?? "—"}</td>`.

**Step 4:** `npm run test && npm run typecheck` green. Commit `feat(takip): steps as a first-class tracker metric`.

---

### Task 5: Goal-aware weight colouring (TDD)

**Files:**
- Modify: `src/lib/metrics.ts` + test
- Modify: `src/app/(app)/takip/page.tsx`

**Step 1: Failing tests:**
```ts
describe("weightPolarityForGoal", () => {
  it("judges direction for directional goals", () => {
    expect(weightPolarityForGoal("fat_loss")).toBe("lowerBetter");
    expect(weightPolarityForGoal("muscle_gain")).toBe("higherBetter");
  });
  it("stays trend-only otherwise", () => {
    expect(weightPolarityForGoal("strength")).toBe("trend");
    expect(weightPolarityForGoal("maintenance")).toBe("trend");
    expect(weightPolarityForGoal(null)).toBe("trend");
  });
});
```

**Step 2: Implement** in metrics.ts:
```ts
/** Training goals that give the weight trend a direction (profile preference).
 * fat_loss → losing reads good; muscle_gain → gaining reads good; anything
 * else keeps weight as an unjudged trend (arrow only). */
export type TrainingGoal = "muscle_gain" | "strength" | "fat_loss" | "maintenance";

export function weightPolarityForGoal(
  goal: TrainingGoal | null | undefined,
): Polarity {
  if (goal === "fat_loss") return "lowerBetter";
  if (goal === "muscle_gain") return "higherBetter";
  return "trend";
}
```

**Step 3: Use it on /takip.** Add `profile_details` fetch to the page's `Promise.all` (`select goal ... eq user_id profile.id maybeSingle`). When building `configs`, for `key === "weight"` override:
```ts
const polarity =
  key === "weight" ? weightPolarityForGoal(details?.goal ?? null) : def.polarity;
// direction is judged against the athlete's own recent mean, not the goal
// weight — "moving the right way" is the signal, not distance from target.
const center =
  key === "weight" && polarity !== "trend"
    ? baseline.mean
    : metricCenter(baseline, goals[key]);
configs[key] = { polarity, center, spread: baseline.spread };
```
The weekly average card logic already keys off `cfg.polarity` — verify weight card shows valence accent when directional.

**Step 4:** tests + typecheck green. Commit `feat(takip): profile goal steers weight colouring`.

---

### Task 6: Profile domain lib (TDD)

**Files:**
- Create: `src/lib/profile.ts`, `src/lib/profile.test.ts`

Registry-style consts with Turkish labels + pure helpers, mirroring `metrics.ts` tone:

```ts
import type { Enums } from "@/lib/database.types";

export type TrainingGoalKey = Enums<"training_goal">;
export type SexKey = Enums<"user_sex">;
export type WeightUnitKey = Enums<"weight_unit">;

export const GOAL_OPTIONS: { key: TrainingGoalKey; label: string; hint: string }[] = [
  { key: "muscle_gain", label: "Kas alımı", hint: "Kilo trendi yukarı okunur" },
  { key: "strength", label: "Güç", hint: "Kilo trendi nötr izlenir" },
  { key: "fat_loss", label: "Yağ kaybı", hint: "Kilo trendi aşağı okunur" },
  { key: "maintenance", label: "Form koruma", hint: "Kilo trendi nötr izlenir" },
];
export const GOAL_LABEL_TR = Object.fromEntries(
  GOAL_OPTIONS.map((g) => [g.key, g.label]),
) as Record<TrainingGoalKey, string>;

export const SEX_OPTIONS: { key: SexKey; label: string }[] = [
  { key: "male", label: "Erkek" },
  { key: "female", label: "Kadın" },
];

export const UNIT_OPTIONS: { key: WeightUnitKey; label: string }[] = [
  { key: "kg", label: "Kilogram (kg)" },
  { key: "lb", label: "Pound (lb)" },
];

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Lowercase/trim a raw handle; returns null when empty, the cleaned handle
 * when valid, or undefined when invalid (caller decides the error message). */
export function normalizeUsername(raw: string | null | undefined) {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "") return null;
  return USERNAME_RE.test(v) ? v : undefined;
}

/** Whole-year age from an ISO birth date, or null. */
export function ageFrom(birthDate: string | null | undefined, today = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00");
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}
```

Tests: normalizeUsername (valid, uppercase→lower, empty→null, bad chars/short/long→undefined), ageFrom (birthday passed/not passed this year, invalid, null). TDD: red → green → commit `feat(profile): domain consts + pure helpers`.

---

### Task 7: /profil editorial rebuild

**Files:**
- Rewrite: `src/app/(app)/profil/page.tsx`, `profile-form.tsx`, `actions.ts`
- Create: `src/app/(app)/profil/details-form.tsx`

**page.tsx** — server component: `requireProfile()` + fetch `profile_details` (maybeSingle). Layout on `LabPage`:
1. `LabHeader` metaLeft `"Profil"`, metaRight role label, title = full name, subtitle = bio or `"Forge sporcusu"`.
2. Künye `PaperCard` (p-5, flex): `Avatar` size-16; name (font-serif text-2xl), `@username` mono muted when set; meta line (mono text-xs muted): `28 yaş · 183 cm · Erkek` from details (render only present parts, joined with `·`).
3. `SectionLabel` **Kimlik** → `PaperCard` with existing `ProfileForm` (extended: username input with `@` prefix, pattern hint `3–20, a-z 0-9 _`).
4. `SectionLabel` **Ölçüler ve tercihler** → `PaperCard` with new `DetailsForm`.
5. Sign-out form (existing).

**actions.ts** — keep `updateProfile`, extend zod with `username` (`.transform(normalizeUsername)` then `.refine(v => v !== undefined, ...)` message `"Kullanıcı adı 3–20 karakter, yalnız küçük harf/rakam/alt çizgi."`), update row incl. `username`; on error code `23505` return `"Bu kullanıcı adı alınmış."`. Add `updateDetails`:

```ts
const detailsSchema = z.object({
  heightCm: z.preprocess(emptyToNull, z.coerce.number().int().min(100).max(250).nullable()),
  birthDate: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  sex: z.preprocess(emptyToNull, z.enum(["male", "female"]).nullable()),
  unit: z.enum(["kg", "lb"]).default("kg"),
  goal: z.preprocess(emptyToNull, z.enum(["muscle_gain","strength","fat_loss","maintenance"]).nullable()),
  weeklyTargetDays: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(7).nullable()),
});
// upsert profile_details onConflict user_id; revalidate /profil, /takip, /bugun
```

**details-form.tsx** — client, `useActionState`, editorial not settings-y: height `Input` (numeric, `cm` suffix), birth date `<Input type="date">`, sex as segmented pill buttons (hidden input), unit select (kg default; helper text `"Görünüm bu fazda kg."`), goal as 2×2 pill grid showing label + hint (hidden input), weekly days as 1–7 stepper chips. `SubmitButton` "Kaydet".

Verify visually later (Task 12). `npm run typecheck && npm run lint`. Commit `feat(profil): identity + private details editorial page`.

---

### Task 8: Cardio lib (TDD) + /takip section

**Files:**
- Create: `src/lib/cardio.ts`, `src/lib/cardio.test.ts`
- Create: `src/app/(app)/takip/cardio-section.tsx`, `cardio-dialog.tsx`
- Modify: `src/app/(app)/takip/actions.ts`, `page.tsx`

**Step 1: lib (TDD).**
```ts
import { Bike, Footprints, Activity, Orbit, Rabbit, Waves, type LucideIcon } from "lucide-react";
import type { Enums } from "@/lib/database.types";

export type CardioActivityKey = Enums<"cardio_activity">;
export type CardioEntry = {
  activity: CardioActivityKey;
  duration_min: number;
  distance_km: number | string | null;
  calories: number | null;
};

export const CARDIO_ACTIVITIES: { key; label; icon: LucideIcon }[] = [
  { key: "walk", label: "Yürüyüş", icon: Footprints },
  { key: "run", label: "Koşu", icon: Rabbit },
  { key: "swim", label: "Yüzme", icon: Waves },
  { key: "bike", label: "Bisiklet", icon: Bike },
  { key: "elliptical", label: "Eliptik", icon: Orbit },
  { key: "other", label: "Diğer", icon: Activity },
];
export const CARDIO_LABEL_TR = ...; // key→label map
export function cardioWeeklySummary(entries: CardioEntry[]) {
  // { totalMin, count, km (sum, 1dp, null if none), topActivity (most minutes, null when empty) }
}
export function formatDuration(min: number) { /* 95 → "1 s 35 dk", 45 → "45 dk" */ }
```
Tests: summary on empty (zeros/null), mixed entries (string distance from PG numeric), topActivity by minutes, formatDuration edge 60.

**Step 2: actions.** `saveCardio(prev, formData)` (`useActionState` style): zod — date regex, activity enum, durationMin int 1–1440, distanceKm 0–500 nullable, calories 0–10000 nullable int, note ≤140. Insert with `athlete_id: profile.id`; revalidate `/takip`. `deleteCardio(formData)`: id uuid, delete `.eq("id").eq("athlete_id", profile.id)` (RLS backstops), revalidate.

**Step 3: page.tsx** — add to `Promise.all`: cardio rows for the visible week (`gte session_date startKey`, `lte endKey`, order date desc) **and** the `profile_details` goal fetch from Task 5. Render `<CardioSection entries weekDays={days} />` between the table `PaperCard` and "Bu hafta". Add a `MeasureCard`-style summary card to "Bu hafta" grid: label `"Kardiyo"`, value `formatDuration(totalMin)` (or `—` when 0), hint `"{count} aktivite"`.

**Step 4: cardio-section.tsx** (server-safe presentational): `SectionLabel` "Kardiyo" + `<CardioDialog />` trigger right-aligned; `PaperCard` list — each row: icon in soft square (like `QuickTile`), label + note (truncate, muted), right-aligned mono `45 dk · 5,2 km · 320 kcal` (present parts only) + day chip (`Çar 2`), delete via icon-button form (`deleteCardio`). Empty state: serif italic `"Bu hafta kardiyo kaydı yok."` + hint text.

**Step 5: cardio-dialog.tsx** (client): Dialog + `useActionState(saveCardio)`; activity picker = icon pill grid (hidden input), date defaults today (clamp within shown week not needed — free date input), duration numeric required, optional distance/calories/note. Toast on ok/error, close+reset on ok.

Tests/typecheck/lint green → commit `feat(takip): cardio entries with weekly section`.

---

### Task 9: Physique storage lib + upload dialog

**Files:**
- Create: `src/lib/physique.ts`
- Create: `src/components/physique/photo-upload-dialog.tsx`
- Create: `src/app/(app)/fizik/actions.ts`

**physique.ts** (server-safe):
```ts
export const PHYSIQUE_BUCKET = "physique";
export const SIGNED_URL_TTL_S = 3600;
export const STALE_AFTER_DAYS = 14;

/** Batch-sign photo paths with the caller's own JWT client, so storage RLS
 * (owner-or-coach SELECT) gates URL minting itself. Returns path→url. */
export async function signPhysiquePaths(supabase, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const { data } = await supabase.storage
    .from(PHYSIQUE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_S);
  return new Map((data ?? []).filter(d => d.signedUrl && d.path).map(d => [d.path!, d.signedUrl]));
}
export function daysSince(isoDate: string, today = new Date()): number { ... }
```

**actions.ts**: `addPhysiquePhoto(prev, formData)` — zod: photoDate regex, storagePath must start `${profile.id}/` (reject foreign-folder rows even before RLS), note ≤280, weightKg 20–300 nullable. Insert row; error → attempt `storage.remove([path])` cleanup + return error state. `deletePhysiquePhoto(formData)` — fetch row by id (RLS-scoped), verify `athlete_id === profile.id`, `storage.remove([storage_path])` then delete row; revalidate `/fizik`, `/bugun`.

**photo-upload-dialog.tsx** (client, mobile-first): follows `ImageUpload` lazy-import pattern but targets the **private** bucket, no public URL:
- file input `accept="image/jpeg,image/png,image/webp"`, 10 MB guard, local `URL.createObjectURL` preview (3/4 aspect).
- On submit: upload to `physique/{user.id}/{crypto.randomUUID()}.{ext}` (`upsert: false`), then call `addPhysiquePhoto` with hidden `storagePath`; on action error the action cleans the object. Fields: date (default today), weight (placeholder = that day's tracked weight passed as prop `todayWeight`), note. Toasts; reset on success.

Typecheck/lint → commit `feat(fizik): private photo upload pipeline`.

---

### Task 10: /fizik page — timeline + compare

**Files:**
- Create: `src/app/(app)/fizik/page.tsx`
- Create: `src/components/physique/photo-timeline.tsx` (client), `compare-view.tsx` (client)
- Modify: `src/components/shell/app-shell.tsx` (athlete secondary nav)

**page.tsx** (server): `requireProfile()`; fetch all own `physique_photos` order `photo_date desc, created_at desc`; sign paths (`signPhysiquePaths`); fetch today's `daily_metrics.weight` for the upload dialog prefill. `LabHeader` metaLeft "Fizik takip", metaRight photo count (`N kayıt`), title "Fizik", subtitle "Aynı ışık, aynı poz — değişimi zaman konuşsun." Header row: `<PhotoUploadDialog todayWeight />`. Then `<PhotoTimeline photos={signed} />`. Empty state `MarginNote` accent green: explanation + first-photo CTA.

**photo-timeline.tsx** (client — owns compare selection):
- Props: `photos: { id, photo_date, note, weight_kg, url }[]`, `canDelete: boolean`.
- Compare bar: sticky top row — text `"Karşılaştır: iki fotoğraf seç"`; when 2 selected render `<CompareView a b />` above the grid (auto-scroll into view) with a close button.
- Grid grouped by month (`formatDate(date, "MMMM yyyy")` section labels): 2 cols mobile / 3 md. Card = `PaperCard p-0 overflow-hidden`: image aspect-[3/4] object-cover; footer p-2: mono date `2 Tem`, weight chip `78,4 kg` when set, note line-clamp-1; selection = ring-2 ring-lab-green + order badge (1/2); delete = small ghost icon top-right (form → `deletePhysiquePhoto`, `confirm()` guard).
- Use plain `<img>` with eslint disable comment (signed URLs; house pattern).

**compare-view.tsx**: two-up grid (`grid-cols-2 gap-3`): each side image + under it mono date + weight; center meta line between headers: `Δ 42 gün · −2,3 kg` (only when both weights). Serif "Önce / Sonra" small labels ordered by date (earlier left, auto-swap).

**Nav**: athlete secondary in `app-shell.tsx` gains `{ href: "/fizik", label: "Fizik", icon: Camera }` (import `Camera`) after Beslenme.

Typecheck/lint → commit `feat(fizik): timeline + before/after compare`.

---

### Task 11: /bugun + coach panel integration

**Files:**
- Modify: `src/app/(app)/bugun/page.tsx`
- Modify: `src/app/(app)/panel/sporcular/[athleteId]/page.tsx`
- Create: `src/app/(app)/panel/sporcular/[athleteId]/fizik/page.tsx`

**Bugün:** add to `Promise.all`: latest physique photo (limit 1), `profile_details` (goal + weekly_target_days). 
- "Bu hafta" Tamamlanan seans card: value becomes `{weekCount} / {weeklyTargetDays}` when target set (mono, muted denominator); hint under when met: `"Haftalık hedef tamam ✓"`.
- New **Fizik** card in the Hızlı erişim area → replace grid with 3 tiles? No — add a dedicated card under "Bu hafta": `Link href="/fizik"` `PaperCard p-4 flex`: signed thumb (size-14 rounded-lg object-cover) or camera icon; text: `"Fizik güncellemesi"` + muted line `"Son fotoğraf X gün önce"` / `"İlk fotoğrafını ekle"`; when `daysSince > 14`: amber `MarginNote`-style nudge text `"Güncelleme zamanı"`. Arrow `→`.

**Coach athlete page:** 
- Header meta: under bio add mono muted line with GOAL_LABEL_TR chip + `hedef {n} gün/hafta` + `boy/yaş` when details exist (fetch `profile_details` in the Promise.all).
- New section **Fizik** (icon `Camera`) after Günlük takip: recent 4 photos (signed thumbs, aspect-[3/4], date under) + `Link` `"Tümü + karşılaştır →"` to `fizik/` subpage. Hidden when none.
- New section **Kardiyo** (icon `HeartPulse`): last 8 `cardio_sessions` rows (reuse `CARDIO_LABEL_TR` + `formatDuration`) in a simple table (Tarih / Aktivite / Süre / Mesafe / kcal). Hidden when none.
- **fizik/page.tsx**: `requireCoach()`, `params: Promise<{ athleteId }>`; fetch athlete name + all photos; reuse `<PhotoTimeline photos canDelete={false} />` (no upload dialog); back-link to athlete page. Compare works for coach (client component is data-agnostic).

Typecheck/lint → commit `feat(bugun,panel): physique + goal + cardio surfaces`.

---

### Task 12: Visual pass (screenshots)

Per memory pattern: `next dev` + headless Chrome, temp public sample routes with mock data for authed screens (add path to `PUBLIC_PATHS`, screenshot at 390×844 **and** 1280×800, then delete route).

- `/profil` (künye + forms), `/fizik` (grid with 4+ placeholder images from `public/`, compare open), `/takip` (steps column + cardio section populated), `/bugun` (fizik card + N/M seans).
- Fix spacing/typography until it reads editorial (serif headings, tracked labels, mono tabular data, calm accents). **Görsel başarı kritik — bu görev aceleye gelmez.**
- Commit any polish separately: `polish(fizik|profil|takip): …`.

---

### Task 13: Live RLS verification (JWT simulation via MCP `execute_sql`)

Same technique as Phase 3 (BEGIN → `set local role authenticated` + `set local request.jwt.claims` → asserts → ROLLBACK). Users: coach + demo athlete + second athlete (create a throwaway second athlete via seed script if only one exists — check `select id, role from profiles`).

Checks (each in its own transaction, all rolled back where mutating):
1. Athlete A inserts/updates own `profile_details` ✓; selects own ✓.
2. Athlete B selects A's `profile_details` → 0 rows; UPDATE → 0 rows.
3. Coach selects A's details ✓; coach UPDATE → 0 rows (read-only confirmed).
4. Same trio for `physique_photos` and `cardio_sessions` (insert as A, B sees 0, coach sees rows, B insert with `athlete_id = A` → blocked by WITH CHECK).
5. Storage: as A `insert into storage.objects (bucket_id, name, owner) values ('physique', '<A-uid>/t.jpg', ...)` ✓ then as B same path → blocked; B `select ... from storage.objects where bucket_id='physique' and name like '<A-uid>/%'` → 0; coach same select → sees rows. Roll back.
6. Anonymous/`profiles`: confirm `username` visible (expected — community identity) but `profile_details` has **no** policy for `anon` (0 rows).

Record the exact SQL + outcomes in the test-scenario doc (Task 14). Fix any failure before proceeding.

---

### Task 14: Final verification + docs

1. `npm run test && npm run build && npm run lint && npm run typecheck` — all green (superpowers:verification-before-completion: paste real output).
2. Write `docs/plans/2026-07-02-profile-physique-cardio-test-scenario.md`: manual test script (profil düzenleme, foto yükleme+karşılaştırma+silme, kardiyo+adım girişi, koç görünümleri) + RLS verification transcript.
3. Update memory `forge-app-state.md` (new module summary, migration numbers 0025/0026 applied live, bucket).
4. superpowers:finishing-a-development-branch → present merge options to user.
