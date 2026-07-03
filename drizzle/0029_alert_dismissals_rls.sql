-- RLS for alert_dismissals — the coach's "görüldü" mark on derived triage
-- alerts. Strictly coach-only: athletes never see (or influence) the coach's
-- triage bookkeeping. Uses public.is_coach() from 0001_security.sql.
--
-- No UPDATE policy on purpose: un-dismissing an alert is a row DELETE, and a
-- re-dismissal is a fresh INSERT (the unique constraint dedupes).

ALTER TABLE public.alert_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_dismissals_select_coach" ON public.alert_dismissals;
CREATE POLICY "alert_dismissals_select_coach"
  ON public.alert_dismissals FOR SELECT
  USING (public.is_coach());

DROP POLICY IF EXISTS "alert_dismissals_insert_coach" ON public.alert_dismissals;
CREATE POLICY "alert_dismissals_insert_coach"
  ON public.alert_dismissals FOR INSERT
  WITH CHECK (public.is_coach() AND dismissed_by = auth.uid());

DROP POLICY IF EXISTS "alert_dismissals_delete_coach" ON public.alert_dismissals;
CREATE POLICY "alert_dismissals_delete_coach"
  ON public.alert_dismissals FOR DELETE
  USING (public.is_coach());
