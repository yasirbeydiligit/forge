-- RLS for tracker_settings: athletes own their single row; coach is read-only.
-- Mirrors the daily_metrics policies (0004).
ALTER TABLE public.tracker_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracker_settings_select" ON public.tracker_settings
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "tracker_settings_insert" ON public.tracker_settings
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "tracker_settings_update" ON public.tracker_settings
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "tracker_settings_delete" ON public.tracker_settings
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());
