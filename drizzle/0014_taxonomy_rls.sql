-- Exercise taxonomy RLS + alternative suggestion (hand-authored; companion to
-- the generated 0013). No table-structure changes here, so the Drizzle snapshot
-- is unchanged from 0013.
--
-- Visibility model:
--   * muscles / muscle_functions  reference data: all authenticated read; coach writes.
--   * exercises                   system rows are public; user rows are owner-only;
--                                 coaches see everything (oversight).
--   * targets / alternatives      SELECT inherits exercise visibility via an EXISTS
--                                 subquery (RLS applies to the referenced table);
--                                 coach writes.
-- Coach detection reuses public.is_coach() from 0001_security.sql.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on the new tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.muscles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muscle_functions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_muscle_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_alternatives   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. muscles / muscle_functions: reference data — all read, coach writes
-- ---------------------------------------------------------------------------
CREATE POLICY "muscles_select_auth" ON public.muscles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "muscles_coach_write" ON public.muscles
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

CREATE POLICY "muscle_functions_select_auth" ON public.muscle_functions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "muscle_functions_coach_write" ON public.muscle_functions
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- 3. exercises: replace the open SELECT with the ownership-aware one
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "exercises_select_auth" ON public.exercises;
CREATE POLICY "exercises_select_visible" ON public.exercises
  FOR SELECT TO authenticated
  USING (is_system = true OR created_by = auth.uid() OR public.is_coach());

-- "exercises_coach_write" (FOR ALL, coach) from 0001 stays in force for system
-- exercises. Additionally let a non-coach owner manage their own user exercises
-- (the user-defined-exercise flow lands in a later phase; harmless now).
CREATE POLICY "exercises_owner_write" ON public.exercises
  FOR ALL TO authenticated
  USING (created_by = auth.uid() AND is_system = false)
  WITH CHECK (created_by = auth.uid() AND is_system = false);

-- ---------------------------------------------------------------------------
-- 4. exercise_muscle_targets: SELECT inherits exercise visibility; coach writes
-- ---------------------------------------------------------------------------
CREATE POLICY "emt_select_visible" ON public.exercise_muscle_targets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.exercises e WHERE e.id = exercise_id)
  );
CREATE POLICY "emt_coach_write" ON public.exercise_muscle_targets
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- 5. exercise_alternatives: SELECT inherits visibility of the base exercise
-- ---------------------------------------------------------------------------
CREATE POLICY "exalt_select_visible" ON public.exercise_alternatives
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.exercises e WHERE e.id = exercise_id)
  );
CREATE POLICY "exalt_coach_write" ON public.exercise_alternatives
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- 6. suggest_exercise_alternatives(p_exercise)
--    Automatic alternatives: same movement_pattern AND at least one shared
--    PRIMARY (muscle+function) target. Ranked by shared primary, then secondary.
--    SECURITY INVOKER (default) + STABLE, so RLS restricts results to the
--    caller's visible exercises and the swap keeps muscle/function tracking
--    continuous (same muscle_function_id).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suggest_exercise_alternatives(p_exercise uuid)
RETURNS TABLE (
  exercise_id uuid,
  name text,
  movement_pattern public.movement_pattern,
  equipment_type public.equipment_type,
  shared_primary integer,
  shared_secondary integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT e.movement_pattern AS mp
    FROM public.exercises e
    WHERE e.id = p_exercise
  ),
  base_primary AS (
    SELECT t.muscle_function_id
    FROM public.exercise_muscle_targets t
    WHERE t.exercise_id = p_exercise AND t.role = 'primary'
  )
  SELECT
    e.id,
    e.name,
    e.movement_pattern,
    e.equipment_type,
    COUNT(*) FILTER (WHERE t.role = 'primary')::int   AS shared_primary,
    COUNT(*) FILTER (WHERE t.role = 'secondary')::int AS shared_secondary
  FROM public.exercises e
  JOIN public.exercise_muscle_targets t ON t.exercise_id = e.id
  CROSS JOIN base
  WHERE e.id <> p_exercise
    AND base.mp IS NOT NULL
    AND e.movement_pattern = base.mp
    AND t.muscle_function_id IN (SELECT muscle_function_id FROM base_primary)
  GROUP BY e.id, e.name, e.movement_pattern, e.equipment_type
  HAVING COUNT(*) FILTER (WHERE t.role = 'primary') > 0
  ORDER BY shared_primary DESC, shared_secondary DESC, e.name;
$$;
