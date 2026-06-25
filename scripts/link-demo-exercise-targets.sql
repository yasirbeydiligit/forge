-- Demo-data backfill: link the legacy slug-less demo exercises (the ones the
-- seeded demo program + log_sets reference) to the Phase 1 taxonomy by copying
-- the matching system exercise's muscle targets onto them. Without this, the
-- muscle-based reports render empty for demo data (the demo exercises predate
-- the taxonomy). Real athletes logging system exercises don't need this.
--
-- Idempotent (ON CONFLICT DO NOTHING + null guards). Applied live once via the
-- Supabase MCP on 2026-06-25. Re-runnable; safe to apply in any environment that
-- has both the demo exercises and the seeded system taxonomy.

WITH mapping(name, sys_slug) AS (
  VALUES
    ('Bench Press', 'barbell-bench-press'),
    ('Deadlift', 'deadlift'),
    ('Barbell Squat', 'back-squat'),
    ('Triceps Pushdown', 'triceps-pushdown'),
    ('Overhead Press', 'overhead-press'),
    ('Plank', 'plank'),
    ('Romanian Deadlift', 'romanian-deadlift'),
    ('Leg Press', 'leg-press'),
    ('Barbell Row', 'barbell-row')
),
pairs AS (
  SELECT legacy.id AS legacy_id, sys.id AS sys_id
  FROM mapping mp
  JOIN public.exercises legacy
    ON legacy.name = mp.name AND legacy.is_system = false AND legacy.slug IS NULL
  JOIN public.exercises sys
    ON sys.slug = mp.sys_slug AND sys.is_system = true
)
INSERT INTO public.exercise_muscle_targets (exercise_id, muscle_function_id, role)
SELECT p.legacy_id, t.muscle_function_id, t.role
FROM pairs p
JOIN public.exercise_muscle_targets t ON t.exercise_id = p.sys_id
ON CONFLICT (exercise_id, muscle_function_id) DO NOTHING;

-- Copy the movement pattern / equipment so the demo exercises are complete
-- (helps suggest_exercise_alternatives); leaves the unique slug untouched.
WITH mapping(name, sys_slug) AS (
  VALUES
    ('Bench Press', 'barbell-bench-press'),
    ('Deadlift', 'deadlift'),
    ('Barbell Squat', 'back-squat'),
    ('Triceps Pushdown', 'triceps-pushdown'),
    ('Overhead Press', 'overhead-press'),
    ('Plank', 'plank'),
    ('Romanian Deadlift', 'romanian-deadlift'),
    ('Leg Press', 'leg-press'),
    ('Barbell Row', 'barbell-row')
)
UPDATE public.exercises legacy
SET movement_pattern = sys.movement_pattern, equipment_type = sys.equipment_type
FROM mapping mp
JOIN public.exercises sys ON sys.slug = mp.sys_slug AND sys.is_system = true
WHERE legacy.name = mp.name AND legacy.is_system = false AND legacy.slug IS NULL
  AND legacy.movement_pattern IS NULL;
