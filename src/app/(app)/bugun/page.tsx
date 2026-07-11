import type { Metadata } from "next";
import { addDays, endOfWeek, getISOWeek, startOfWeek, subDays } from "date-fns";

import { TodayView, type TodayViewProps } from "./today-view";
import { ProtocolItem } from "@/app/(app)/beslenme/protocol-checklist";
import { requireProfile } from "@/lib/auth";
import { cardioWeeklySummary } from "@/lib/cardio";
import { loadGazeteSignal } from "@/lib/gazete/signal";
import { formatDate, formatNumber, formatRepRange, toDateKey } from "@/lib/format";
import { STALE_AFTER_DAYS, daysSince, signPhysiquePaths } from "@/lib/physique";
import { getAthleteInsights } from "@/lib/rag/insights-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeMetric } from "@/lib/today/metrics-window";
import { buildWeekStrip } from "@/lib/today/week-strip";
import type { CardioSession, Meal, NutritionTarget } from "@/lib/types";

export const metadata: Metadata = { title: "Bugün" };

/** Trailing window (days) pulled once for the weight/steps trend sparklines. */
const METRIC_WINDOW_DAYS = 14;

type TodayExercise = {
  order_index: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight: number | null;
  exercise: { name: string } | null;
};

function plannedLine(e: TodayExercise): string {
  const reps = formatRepRange(e.target_reps_min, e.target_reps_max);
  const base =
    e.target_sets && reps
      ? `${e.target_sets} × ${reps}`
      : e.target_sets
        ? `${e.target_sets} set`
        : reps
          ? `${reps} tekrar`
          : "—";
  return e.target_weight ? `${base} @ ${formatNumber(e.target_weight)}` : base;
}

export default async function TodayPage() {
  const profile = await requireProfile();
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekStartDate = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = toDateKey(weekStartDate);
  const weekEnd = toDateKey(endOfWeek(today, { weekStartsOn: 1 }));
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    toDateKey(addDays(weekStartDate, i)),
  );
  const metricStart = toDateKey(subDays(today, METRIC_WINDOW_DAYS));

  const supabase = await createSupabaseServerClient();
  const [
    { data: weekAssignmentsData },
    { data: todayAssignmentsData },
    { data: weekSessions },
    { count: programCount },
    { data: targetData },
    { data: mealsData },
    { data: metricsData },
    { data: cardioData },
    { data: details },
    { data: lastPhotoData },
    { data: protocolAssignmentData },
    { data: protocolCompletionData },
  ] = await Promise.all([
    supabase
      .from("calendar_assignments")
      .select("id, scheduled_date, workout:workouts(name)")
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd),
    supabase
      .from("calendar_assignments")
      .select(
        "id, workout:workouts(name, workout_exercises(order_index, target_sets, target_reps_min, target_reps_max, target_weight, exercise:exercises(name)))",
      )
      .eq("scheduled_date", todayKey),
    supabase
      .from("log_sessions")
      .select("session_date, assignment_id, completed")
      .eq("athlete_id", profile.id)
      .gte("session_date", weekStart)
      .lte("session_date", weekEnd),
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", profile.id),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("athlete_id", profile.id)
      .maybeSingle(),
    supabase
      .from("meals")
      .select("kcal, protein, carbs, fat")
      .eq("athlete_id", profile.id)
      .eq("meal_date", todayKey),
    supabase
      .from("daily_metrics")
      .select("metric_date, weight, steps, water_ml")
      .eq("athlete_id", profile.id)
      .gte("metric_date", metricStart)
      .lte("metric_date", todayKey),
    supabase
      .from("cardio_sessions")
      .select("activity, duration_min, distance_km, calories, session_date")
      .eq("athlete_id", profile.id)
      .gte("session_date", weekStart)
      .lte("session_date", weekEnd),
    supabase
      .from("profile_details")
      .select("weekly_target_days")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("physique_photos")
      .select("photo_date, storage_path")
      .eq("athlete_id", profile.id)
      .order("photo_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("protocol_assignments")
      .select(
        "protocol:protocol_templates(id, name, timing, instructions, order_index, is_active)",
      )
      .eq("athlete_id", profile.id),
    supabase
      .from("protocol_completions")
      .select("protocol_id, completed_at")
      .eq("athlete_id", profile.id)
      .eq("completion_date", todayKey),
  ]);

  // ---- Week strip + today's completion state -----------------------------
  const weekAssignments = (weekAssignmentsData ?? []) as unknown as {
    id: string;
    scheduled_date: string;
    workout: { name: string } | null;
  }[];
  const sessions = (weekSessions ?? []) as {
    session_date: string;
    assignment_id: string | null;
    completed: boolean;
  }[];
  const completedDates = sessions
    .filter((s) => s.completed)
    .map((s) => s.session_date);
  const weekStripCells = buildWeekStrip({
    days: weekDays,
    todayKey,
    assignments: weekAssignments,
    completedDates,
  });
  const weekCompletedCount = new Set(completedDates).size;
  const todayDone = completedDates.includes(todayKey);

  // ---- Today's workout (smart entry) -------------------------------------
  const todayAssignments = (todayAssignmentsData ?? []) as unknown as {
    id: string;
    workout: { name: string; workout_exercises: TodayExercise[] } | null;
  }[];
  const firstAssignment = todayAssignments.find((a) => a.workout) ?? null;
  let workout: TodayViewProps["workout"] = null;
  if (firstAssignment?.workout) {
    const items = [...(firstAssignment.workout.workout_exercises ?? [])].sort(
      (x, y) => x.order_index - y.order_index,
    );
    const preview = items.slice(0, 5);
    workout = {
      name: firstAssignment.workout.name,
      exercises: preview.map((e) => ({
        name: e.exercise?.name ?? "Egzersiz",
        line: plannedLine(e),
      })),
      moreCount: items.length - preview.length,
      assignmentId: firstAssignment.id,
      done: todayDone,
    };
  }

  // ---- Nutrition ---------------------------------------------------------
  const target = targetData as NutritionTarget | null;
  const meals = (mealsData ?? []) as Pick<
    Meal,
    "kcal" | "protein" | "carbs" | "fat"
  >[];
  const nutrition: TodayViewProps["nutrition"] = {
    has: meals.length > 0 || target != null,
    kcal: meals.reduce((a, m) => a + (m.kcal ?? 0), 0),
    protein: meals.reduce((a, m) => a + (m.protein ?? 0), 0),
    carbs: meals.reduce((a, m) => a + (m.carbs ?? 0), 0),
    fat: meals.reduce((a, m) => a + (m.fat ?? 0), 0),
    targetKcal: target?.kcal ?? null,
    targetProtein: target?.protein ?? null,
    targetCarbs: target?.carbs ?? null,
    targetFat: target?.fat ?? null,
  };

  // ---- Metrics window: steps, weight, hydration --------------------------
  const metricRows = (metricsData ?? []) as {
    metric_date: string;
    weight: string | number | null;
    steps: number | null;
    water_ml: number | null;
  }[];
  const stepsSummary = summarizeMetric(metricRows, "steps", todayKey);
  const weightSummary = summarizeMetric(metricRows, "weight", todayKey);
  const waterMl =
    metricRows.find((m) => m.metric_date === todayKey)?.water_ml ?? 0;

  // ---- Cardio (this week) ------------------------------------------------
  const cardio = cardioWeeklySummary((cardioData ?? []) as CardioSession[]);

  // ---- Physique nudge ----------------------------------------------------
  const lastPhoto = lastPhotoData as
    | { photo_date: string; storage_path: string }
    | null;
  const photoUrls = lastPhoto
    ? await signPhysiquePaths(supabase, [lastPhoto.storage_path])
    : null;
  const photoAgeDays = lastPhoto ? daysSince(lastPhoto.photo_date) : null;

  // ---- Protocols (only shown when assigned) ------------------------------
  const completionByProtocol = new Map(
    (protocolCompletionData ?? []).map((c) => [c.protocol_id, c.completed_at]),
  );
  const protocols: ProtocolItem[] = (protocolAssignmentData ?? [])
    .map((a) => a.protocol)
    .filter((p): p is NonNullable<typeof p> => p != null && p.is_active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      timing: p.timing,
      instructions: p.instructions,
      order_index: p.order_index,
      done: completionByProtocol.has(p.id),
      completedAt: completionByProtocol.get(p.id) ?? null,
    }));

  const insights = await getAthleteInsights(supabase, profile.id, "nutrition");
  // Request-cached — the app layout's nav badge already computed this.
  const gazete = await loadGazeteSignal(profile.id);

  return (
    <TodayView
      firstName={profile.full_name.split(" ")[0]}
      gazeteNewCount={gazete.newCount}
      todayKey={todayKey}
      dateLabel={formatDate(todayKey, "EEEE, d MMMM")}
      weekNo={getISOWeek(today)}
      weekStripCells={weekStripCells}
      workout={workout}
      nutrition={nutrition}
      insights={insights}
      steps={{ today: stepsSummary.todayValue, series: stepsSummary.series }}
      weight={{
        latest: weightSummary.latest,
        delta: weightSummary.delta,
        series: weightSummary.series,
      }}
      hydration={{ current: waterMl, target: target?.water_ml ?? null }}
      cardio={{
        totalMin: cardio.totalMin,
        count: cardio.count,
        topActivity: cardio.topActivity,
      }}
      physique={{
        url: lastPhoto
          ? (photoUrls?.get(lastPhoto.storage_path) ?? null)
          : null,
        hasPhoto: lastPhoto != null,
        ageDays: photoAgeDays,
        stale: photoAgeDays != null && photoAgeDays > STALE_AFTER_DAYS,
      }}
      protocols={protocols}
      week={{
        completed: weekCompletedCount,
        target: details?.weekly_target_days ?? null,
        programCount: programCount ?? 0,
      }}
    />
  );
}
