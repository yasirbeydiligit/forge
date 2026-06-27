-- Self-service exercises & programs: RLS so athletes (and coaches) own their
-- user-defined exercises and athletes own their personal programs, while the
-- coach keeps read-only oversight. No table-structure changes here, so the
-- Drizzle snapshot is unchanged from 0018 — apply this hand-authored SQL live
-- via the Supabase MCP (like 0014), NOT drizzle migrate.
--
-- Visibility model (see docs/plans/2026-06-26-self-service-exercises-programs-design.md):
--   * exercises            unchanged — system rows public, user rows owner-only,
--                          coach all (0001 + 0014 already cover this).
--   * exercise_muscle_targets  + owner of a non-system exercise may write its targets.
--   * programs             owner-based write; athletes can never community-publish;
--                          coach is read-only on athlete programs. Owner sees own drafts.
--   * workouts / workout_exercises  SELECT + write inherit parent-program visibility
--                          and ownership (hides personal-program content from others).
--   * calendar_assignments  athletes may schedule only their own program for themselves.
-- Coach detection reuses public.is_coach() from 0001_security.sql.

-- ---------------------------------------------------------------------------
-- 1. exercise_muscle_targets: let the exercise owner manage its targets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "emt_owner_write" ON public.exercise_muscle_targets;
CREATE POLICY "emt_owner_write" ON public.exercise_muscle_targets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = exercise_id
        AND e.created_by = auth.uid()
        AND e.is_system = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exercises e
      WHERE e.id = exercise_id
        AND e.created_by = auth.uid()
        AND e.is_system = false
    )
  );

-- ---------------------------------------------------------------------------
-- 2. programs: owner-based access
--    SELECT  coach all | community published | own (incl. personal drafts)
--    WRITE   own rows only; athletes forced to is_published = false
--            (=> coach read-only on athlete programs, athletes never publish)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "programs_select" ON public.programs;
CREATE POLICY "programs_select" ON public.programs
  FOR SELECT TO authenticated
  USING (public.is_coach() OR is_published OR created_by = auth.uid());

DROP POLICY IF EXISTS "programs_coach_write" ON public.programs;
DROP POLICY IF EXISTS "programs_write" ON public.programs;
CREATE POLICY "programs_write" ON public.programs
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_coach() OR is_published = false)
  );

-- ---------------------------------------------------------------------------
-- 3. workouts: SELECT inherits program visibility; write inherits ownership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "workouts_select_auth" ON public.workouts;
DROP POLICY IF EXISTS "workouts_select_visible" ON public.workouts;
CREATE POLICY "workouts_select_visible" ON public.workouts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_id));

DROP POLICY IF EXISTS "workouts_coach_write" ON public.workouts;
DROP POLICY IF EXISTS "workouts_write" ON public.workouts;
CREATE POLICY "workouts_write" ON public.workouts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = program_id AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = program_id AND p.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. workout_exercises: SELECT + write inherit the workout's program
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "workout_exercises_select_auth" ON public.workout_exercises;
DROP POLICY IF EXISTS "workout_exercises_select_visible" ON public.workout_exercises;
CREATE POLICY "workout_exercises_select_visible" ON public.workout_exercises
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id));

DROP POLICY IF EXISTS "workout_exercises_coach_write" ON public.workout_exercises;
DROP POLICY IF EXISTS "workout_exercises_write" ON public.workout_exercises;
CREATE POLICY "workout_exercises_write" ON public.workout_exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      JOIN public.programs p ON p.id = w.program_id
      WHERE w.id = workout_id AND p.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      JOIN public.programs p ON p.id = w.program_id
      WHERE w.id = workout_id AND p.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. calendar_assignments: athletes schedule only their own program, for self
--    (coach keeps the broad calendar_coach_write from 0001).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendar_owner_write" ON public.calendar_assignments;
CREATE POLICY "calendar_owner_write" ON public.calendar_assignments
  FOR ALL TO authenticated
  USING (athlete_id = auth.uid() AND created_by = auth.uid())
  WITH CHECK (
    athlete_id = auth.uid()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = program_id AND p.created_by = auth.uid()
    )
  );
