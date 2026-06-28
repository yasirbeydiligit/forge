/**
 * Server-side loader for a coach's weekly nutrition + protocol-compliance view
 * of one athlete. Reads the week's meals, the athlete's macro target, their
 * assigned active protocols and that week's completions, then runs the pure
 * buildNutritionWeekly. Coach read access is enforced by RLS (the athlete-detail
 * page already reads the same athlete's tables).
 */
import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildNutritionWeekly,
  type NutritionWeeklyReport,
  type WeeklyAssignment,
} from "@/lib/reports/nutrition-weekly";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

type AssignmentRow = {
  protocol:
    | { id: string; name: string; timing: string; is_active: boolean }
    | null;
};

export async function loadNutritionWeekly(
  supabase: Client,
  athleteId: string,
  weekStart: string,
  weekEnd: string,
): Promise<NutritionWeeklyReport> {
  const weekDates = eachDayOfInterval({
    start: parseISO(weekStart),
    end: parseISO(weekEnd),
  }).map((d) => format(d, "yyyy-MM-dd"));

  const [
    { data: mealsData },
    { data: targetData },
    { data: assignmentData },
    { data: completionData },
  ] = await Promise.all([
    supabase
      .from("meals")
      .select("meal_date, eaten_at, name, kcal, protein, carbs, fat")
      .eq("athlete_id", athleteId)
      .gte("meal_date", weekStart)
      .lte("meal_date", weekEnd),
    supabase
      .from("nutrition_targets")
      .select("kcal, protein, carbs, fat")
      .eq("athlete_id", athleteId)
      .maybeSingle(),
    supabase
      .from("protocol_assignments")
      .select("protocol:protocol_templates(id, name, timing, is_active)")
      .eq("athlete_id", athleteId),
    supabase
      .from("protocol_completions")
      .select("protocol_id, completion_date, completed_at")
      .eq("athlete_id", athleteId)
      .gte("completion_date", weekStart)
      .lte("completion_date", weekEnd),
  ]);

  const assignments: WeeklyAssignment[] = ((assignmentData ?? []) as AssignmentRow[])
    .map((a) => a.protocol)
    .filter((p): p is NonNullable<typeof p> => p != null && p.is_active)
    .map((p) => ({ protocol_id: p.id, name: p.name, timing: p.timing }));

  return buildNutritionWeekly({
    weekDates,
    meals: mealsData ?? [],
    target: targetData ?? null,
    assignments,
    completions: completionData ?? [],
  });
}
