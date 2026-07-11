-- RLS for report_issues (Forge Gazete): athletes print & read their own
-- issues; the coach is read-only. Issues are immutable once printed — the
-- column-level GRANT below restricts athlete updates to read_at only.
ALTER TABLE public.report_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_issues_select" ON public.report_issues
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());

-- Lazy generation runs under the athlete's own JWT: they print their own copy.
CREATE POLICY "report_issues_insert" ON public.report_issues
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "report_issues_update" ON public.report_issues
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());

-- No DELETE policy: a printed issue stays in the archive.

-- Immutability guard: UPDATE may only touch read_at.
REVOKE UPDATE ON TABLE public.report_issues FROM authenticated;
GRANT UPDATE (read_at) ON TABLE public.report_issues TO authenticated;
