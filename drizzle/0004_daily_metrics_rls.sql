-- RLS for daily_metrics: athletes own their rows; coach is read-only.
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_metrics_select" ON public.daily_metrics
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "daily_metrics_insert" ON public.daily_metrics
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "daily_metrics_update" ON public.daily_metrics
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "daily_metrics_delete" ON public.daily_metrics
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());
