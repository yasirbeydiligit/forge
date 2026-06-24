# Exercise taxonomy CSV — fill guide

Edit `scripts/exercise-taxonomy.csv` (one exercise per row), then import with:

```bash
npm run seed:taxonomy            # upsert every row into the DB (by slug)
npm run seed:taxonomy -- --dry   # parse + validate only, write nothing
```

Import is **idempotent**: rows are upserted on `slug`, so re-running updates in
place (it never duplicates). All imported rows are marked `is_system = true`.
Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
(the importer uses the service-role client and bypasses RLS).

## Columns

| Column | Required | Notes |
|---|---|---|
| `slug` | ✅ | stable unique key, kebab-case (e.g. `barbell-bench-press`). The upsert key. |
| `name` | ✅ | display name (any language). |
| `movement_pattern` | ✅ | one value from the list below. The backbone of alternative matching. |
| `equipment_type` | ✅ | one value from the list below. |
| `primary_functions` | ✅ | `;`-separated muscle-function slugs. **At least one.** |
| `secondary_functions` |  | `;`-separated muscle-function slugs, or empty. |
| `alternative_slugs` |  | `;`-separated **exercise** slugs (manual alternatives), or empty. Each must be another row's `slug`. |
| `category` |  | legacy display grouping (e.g. `Sırt`). |
| `description` |  | optional. |
| `video_url` |  | optional. |

> A muscle function fully identifies a (muscle + function) target — the muscle is
> derived through the function. Reporting tracks volume per function, so an
> alternative that shares the same **primary** function keeps history continuous.

## Valid `movement_pattern`

`push_horizontal`, `push_vertical`, `pull_horizontal`, `pull_vertical`,
`squat`, `hinge`, `lunge`, `isolation`, `carry`, `core`, `rotation`

## Valid `equipment_type`

`barbell`, `dumbbell`, `machine`, `cable`, `bodyweight`, `kettlebell`,
`band`, `smith`, `ez_bar`, `trap_bar`, `other`

## Valid muscle-function slugs (use these in primary/secondary)

Grouped by muscle (slug — Turkish):

**Göğüs (chest):** `chest-horizontal-adduction`, `chest-shoulder-flexion`
**Sırt/Lat (lat):** `lat-shoulder-extension`, `lat-shoulder-adduction`
**Trapez:** `traps-elevation` (üst), `traps-mid-retraction` (orta), `traps-depression` (alt)
**Romboidler:** `rhomboids-retraction`
**Arka omuz:** `rear-delt-horizontal-abduction`
**Yan omuz:** `side-delt-abduction`
**Ön omuz:** `front-delt-shoulder-flexion`
**Biceps:** `biceps-elbow-flexion`, `biceps-supination`
**Brakialis:** `brachialis-elbow-flexion`
**Triceps:** `triceps-elbow-extension`
**Ön kol:** `forearm-wrist-flexion`
**Quadriceps:** `quads-knee-extension`
**Hamstring:** `hamstrings-knee-flexion`, `hamstrings-hip-extension`
**Kalça (glute max):** `glutes-hip-extension`
**Orta gluteal:** `glute-med-hip-abduction`
**Baldır:** `calves-plantarflexion` (gastro), `soleus-plantarflexion` (soleus)
**İç bacak:** `adductors-hip-adduction`
**Kalça bükücüler:** `hip-flexors-hip-flexion`
**Karın (rektus):** `abs-trunk-flexion`
**Oblikler:** `obliques-rotation`, `obliques-lateral-flexion`
**Bel dikleştiriciler:** `erectors-spinal-extension`, `erectors-anti-flexion`

> Need a muscle or function that isn't here? Add it to
> `drizzle/0015_taxonomy_seed.sql` (and re-run that migration), then reference
> its new slug. The importer rejects unknown function slugs with a clear error.
