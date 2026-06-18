-- RLS for nutrition tables: athletes own their rows; coach is read-only.
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meals_select" ON public.meals
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "meals_insert" ON public.meals
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "meals_update" ON public.meals
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "meals_delete" ON public.meals
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());

CREATE POLICY "nutrition_targets_select" ON public.nutrition_targets
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "nutrition_targets_insert" ON public.nutrition_targets
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "nutrition_targets_update" ON public.nutrition_targets
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "nutrition_targets_delete" ON public.nutrition_targets
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());
