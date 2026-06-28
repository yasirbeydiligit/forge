# Günlük takip: selectable columns + relative colouring

Date: 2026-06-28
Branch: `feat/takip-metrics`

## Goal

Upgrade the `/takip` weekly tracker so the athlete can:

1. **Choose which metrics to track** (toggle columns on/off) and set optional
   goals, persisted as a per-user preference. Add a new **digestion** metric.
2. **Read the table at a glance** via calm, colour-blind-friendly valence
   colouring whose thresholds are **relative to the athlete's own recent
   baseline** (or their goal), not absolute constants.
3. Enter daily values **fast on mobile** (inline edit, numeric keypads).

Keep the existing structure intact: server page + `MetricRow` inline edit +
`MeasureCard` averages all stay; we extend, not rewrite.

## Decisions (from brainstorming)

- **Data model:** code-level metric *registry* + **real typed columns**. No EAV.
  `digestion` becomes a real `daily_metrics` column. The user's enabled set and
  goals live in a small `tracker_settings` row as JSON.
- **Weight colouring:** trend-only — never painted good/bad (its "good"
  direction depends on cut/bulk/maintain, which we don't ask). Show a neutral
  direction arrow only.
- **Goals:** set inside the column-settings dialog (one place).

## Data model

`daily_metrics` (add one column):

```
digestion  integer        -- 0..10 scale, like energy/hunger
```

`tracker_settings` (new, one row per athlete):

```
athlete_id  uuid  PK  FK -> profiles(id) on delete cascade
enabled     jsonb not null   -- ["weight","sleep_hours",...] metric keys
goals       jsonb not null default '{}'  -- { "sleep_hours": 8, "weight": 78 }
updated_at  timestamptz not null default now()
```

RLS mirrors `daily_metrics`: athlete owns their row, coach read-only via
`is_coach()`. Default (no row) = current six metrics + notes; digestion opt-in
so nothing disappears for existing users.

## Metric registry (`src/lib/metrics.ts`)

One entry per metric: `{ key, label, short, unit, range, decimals, polarity,
goalAllowed, spreadFloor, inputMode }`.

Polarity:

| metric       | polarity      | goal |
|--------------|---------------|------|
| weight       | trend         | yes (arrow only) |
| sleep_hours  | higherBetter  | yes  |
| resting_hr   | lowerBetter   | yes  |
| energy       | higherBetter  | no   |
| hunger       | lowerBetter   | no   |
| adherence    | higherBetter  | no   |
| digestion    | higherBetter  | no   |
| notes        | none          | no   |

## Relative colouring (pure, TDD)

Server (`page.tsx`) loads the trailing ~28 days before the shown week and, per
metric, computes a **baseline**: `mean` and `spread = max(stddev, spreadFloor)`.
Fewer than `MIN_BASELINE_SAMPLES` (4) → `mean = null`.

`valence(value, { polarity, center, spread, band = 0.5 })`:

- `center` = goal if set, else `baseline.mean`. If `center` is null → `none`
  (not enough history and no goal → don't judge day 1).
- `d = value − center`; within `±band·spread` → **neutral**; otherwise good/bad
  per polarity (`higherBetter`: above = good; `lowerBetter`: below = good).
- `trend`/`none` polarity → always `none`.

A goal makes colouring work immediately (center defined) even with little
history, using `spreadFloor` as the band width.

**Colour-blind friendly:** each coloured cell gets a soft tint **plus** a
valence glyph that encodes meaning independent of hue — `▲` good, `–` neutral,
`▼` bad (so a *dropping* RHR still reads `▲` good). Weight shows a neutral
direction arrow (`↑/↓/→`) only. New palette token `--lab-rose` for "bad".

## UI

- `takip/settings-dialog.tsx` (new client): switch per column + goal inputs for
  `goalAllowed` metrics. Saves via `saveTrackerSettings`.
- `takip/metric-row.tsx`: render only enabled cells; tint + glyph from
  `valence`; keep inline edit; mobile polish (select-on-focus, Enter advances).
- `takip/page.tsx`: read settings + baselines; enabled headers; `MeasureCard`s
  reflect enabled set incl. digestion, with a valence accent.

## Testing

- `src/lib/metrics.test.ts`: `computeBaseline` (insufficient/std/floor/non-finite),
  `valence` (higher/lower/trend/goal/null-center/band edges), `metricCenter`,
  `trend`, registry sanity.
- Manual scenario at the end: column toggle, digestion entry, relative colour.

## Out of scope (YAGNI)

Column drag-reorder, EAV metric tables, coach-side column config, per-metric
custom scales.
