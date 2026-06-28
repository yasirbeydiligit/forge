-- Hand-authored (RLS-only; NOT in the drizzle journal). Applied live via the
-- Supabase MCP on 2026-06-28, like 0019/0020. Coach detection reuses
-- public.is_coach() from 0001_security.sql.
--
-- Visibility model (see docs/plans/2026-06-28-nutrition-expansion-design.md):
--   * meal_templates       owner-only ("hazır öğün" library). Coach has NO access.
--   * protocol_templates   coach writes; an assigned athlete (or any coach) reads.
--   * protocol_assignments coach writes; coach or the assigned athlete reads.
--   * protocol_completions athlete owns; coach reads (compliance). An athlete may
--                          only complete a protocol currently assigned to them.

ALTER TABLE public.meal_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_completions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- meal_templates: only the owner, every operation. Coach is intentionally out.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "meal_templates_all" ON public.meal_templates;
CREATE POLICY "meal_templates_all" ON public.meal_templates
  FOR ALL TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- ---------------------------------------------------------------------------
-- protocol_templates: coach writes; assigned athlete (or any coach) reads.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "protocol_templates_select" ON public.protocol_templates;
CREATE POLICY "protocol_templates_select" ON public.protocol_templates
  FOR SELECT TO authenticated
  USING (
    public.is_coach()
    OR EXISTS (
      SELECT 1 FROM public.protocol_assignments a
      WHERE a.protocol_id = protocol_templates.id
        AND a.athlete_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "protocol_templates_write" ON public.protocol_templates;
CREATE POLICY "protocol_templates_write" ON public.protocol_templates
  FOR ALL TO authenticated
  USING (public.is_coach())
  WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- protocol_assignments: coach writes; coach or the assigned athlete reads.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "protocol_assignments_select" ON public.protocol_assignments;
CREATE POLICY "protocol_assignments_select" ON public.protocol_assignments
  FOR SELECT TO authenticated
  USING (public.is_coach() OR athlete_id = auth.uid());
DROP POLICY IF EXISTS "protocol_assignments_write" ON public.protocol_assignments;
CREATE POLICY "protocol_assignments_write" ON public.protocol_assignments
  FOR ALL TO authenticated
  USING (public.is_coach())
  WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- protocol_completions: athlete owns; coach reads. An athlete may only insert a
-- completion for a protocol that is currently assigned to them.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "protocol_completions_select" ON public.protocol_completions;
CREATE POLICY "protocol_completions_select" ON public.protocol_completions
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
DROP POLICY IF EXISTS "protocol_completions_insert" ON public.protocol_completions;
CREATE POLICY "protocol_completions_insert" ON public.protocol_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    athlete_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.protocol_assignments a
      WHERE a.protocol_id = protocol_completions.protocol_id
        AND a.athlete_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "protocol_completions_delete" ON public.protocol_completions;
CREATE POLICY "protocol_completions_delete" ON public.protocol_completions
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());
