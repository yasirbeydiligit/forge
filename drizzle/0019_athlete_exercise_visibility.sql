-- Hand-authored (RLS-only; no table-structure change, so the Drizzle snapshot is
-- unchanged from 0018). Applied live via the Supabase MCP on 2026-06-27.
--
-- Lets an athlete read exercises they have logged, or that appear in a program
-- they're enrolled in, so their own post-session report and the session player
-- resolve exercise names + muscle/region targets even for coach-created
-- (non-system) exercises. Permissive SELECT policy, OR'd with the existing
-- exercises_select_visible (system / owner / coach). Scoped via EXISTS — it does
-- NOT expose arbitrary coach-private exercises the athlete never touched.

DROP POLICY IF EXISTS "exercises_select_logged" ON public.exercises;
CREATE POLICY "exercises_select_logged" ON public.exercises
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.log_sets ls
      JOIN public.log_sessions s ON s.id = ls.session_id
      WHERE ls.exercise_id = exercises.id AND s.athlete_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.workout_exercises we
      JOIN public.workouts w ON w.id = we.workout_id
      JOIN public.enrollments e ON e.program_id = w.program_id
      WHERE we.exercise_id = exercises.id AND e.athlete_id = auth.uid()
    )
  );
