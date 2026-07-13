/**
 * Forge Gazete lazy printing — the thin query layer.
 *
 * Runs under the athlete's own JWT (RLS is the access-control authority):
 * when the athlete opens /gazete we detect closed-but-unprinted periods via
 * the pure duePeriods() and print each one through the pure pipeline
 * (aggregatePeriod → buildIssue) into report_issues. All heavy logic lives in
 * the tested pure modules; this file only fetches rows and inserts.
 */
import { addMonths, subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { parseDateKey, toDateKey } from "@/lib/format";

import { aggregatePeriod, type AggregateRows, type PeriodAggregates } from "./aggregate";
import { buildIssue, type IssuePayload } from "./build-issue";
import type { TrainingGoal } from "./facts";
import { duePeriods, nextMilestone, type Period } from "./periods";

type Client = SupabaseClient<Database>;

/** How far back the PR frontier looks (mirrors the coach weekly report). */
const PR_HISTORY_DAYS = 365;

/** Photo-pairing tolerance around period boundaries, per period type. */
const PHOTO_TOLERANCE_DAYS = { monthly: 14, milestone: 21 } as const;

/**
 * The athlete's journey start: the earliest trace they left in the system.
 * Null when there is no data at all (then there is nothing to print).
 */
export async function loadJourneyStart(
  supabase: Client,
  athleteId: string,
): Promise<string | null> {
  const [{ data: session }, { data: metric }, { data: enrollment }] =
    await Promise.all([
      supabase
        .from("log_sessions")
        .select("session_date")
        .eq("athlete_id", athleteId)
        .order("session_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("daily_metrics")
        .select("metric_date")
        .eq("athlete_id", athleteId)
        .order("metric_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("enrolled_at")
        .eq("athlete_id", athleteId)
        .order("enrolled_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const candidates = [
    session?.session_date,
    metric?.metric_date,
    enrollment?.enrolled_at?.slice(0, 10),
  ].filter((d): d is string => d != null);
  if (candidates.length === 0) return null;
  return candidates.sort()[0];
}

type SetTargetRow = {
  role: "primary" | "secondary";
  muscle_functions: {
    muscles: { slug: string; name_tr: string } | null;
  } | null;
};

type SetRow = {
  session_id: string;
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  exercise: {
    name: string;
    region: string | null;
    exercise_muscle_targets: SetTargetRow[];
  } | null;
};

/** Same taxonomy join the coach weekly loader uses — numbers must agree. */
const SET_SELECT =
  "session_id, exercise_id, weight, reps, rir, exercise:exercises(name, region, exercise_muscle_targets(role, muscle_functions(muscles(slug, name_tr))))";

function toMuscles(rows: SetTargetRow[]) {
  const out: { slug: string; nameTr: string; role: "primary" | "secondary" }[] = [];
  for (const t of rows) {
    const muscle = t.muscle_functions?.muscles;
    if (!muscle) continue;
    out.push({ slug: muscle.slug, nameTr: muscle.name_tr, role: t.role });
  }
  return out;
}

/** Fetch one period's raw rows. `light` skips PR/new-exercise history (used
 *  for the previous-period comparator, which never reports PRs). */
async function loadAggregateRows(
  supabase: Client,
  athleteId: string,
  period: { start: string; end: string },
  opts: { light: boolean },
): Promise<AggregateRows> {
  const [
    { data: sessions },
    { data: metrics },
    { data: meals },
    { data: target },
    { data: cardio },
    { data: assignments },
    { count: completionCount },
    { data: details },
  ] = await Promise.all([
    supabase
      .from("log_sessions")
      .select("id, session_date, completed")
      .eq("athlete_id", athleteId)
      .gte("session_date", period.start)
      .lte("session_date", period.end),
    supabase
      .from("daily_metrics")
      .select(
        "metric_date, weight, sleep_hours, resting_hr, energy, hunger, adherence, digestion, steps, water_ml",
      )
      .eq("athlete_id", athleteId)
      .gte("metric_date", period.start)
      .lte("metric_date", period.end),
    supabase
      .from("meals")
      .select("meal_date, kcal, protein, carbs, fat")
      .eq("athlete_id", athleteId)
      .gte("meal_date", period.start)
      .lte("meal_date", period.end),
    supabase
      .from("nutrition_targets")
      .select("kcal, protein, carbs, fat, water_ml")
      .eq("athlete_id", athleteId)
      .maybeSingle(),
    supabase
      .from("cardio_sessions")
      .select("duration_min, distance_km")
      .eq("athlete_id", athleteId)
      .gte("session_date", period.start)
      .lte("session_date", period.end),
    supabase
      .from("protocol_assignments")
      .select("protocol:protocol_templates(id, is_active)")
      .eq("athlete_id", athleteId),
    supabase
      .from("protocol_completions")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .gte("completion_date", period.start)
      .lte("completion_date", period.end),
    supabase
      .from("profile_details")
      .select("weekly_target_days")
      .eq("user_id", athleteId)
      .maybeSingle(),
  ]);

  const sessionRows = (sessions ?? []).map((s) => ({
    id: s.id,
    date: s.session_date,
    completed: s.completed,
  }));
  const sessionDate = new Map(sessionRows.map((s) => [s.id, s.date]));
  const sessionIds = [...sessionDate.keys()];

  let sets: AggregateRows["sets"] = [];
  if (sessionIds.length > 0) {
    const { data: rawSets } = await supabase
      .from("log_sets")
      .select(SET_SELECT)
      .in("session_id", sessionIds);
    sets = ((rawSets ?? []) as unknown as SetRow[]).map((r) => ({
      sessionId: r.session_id,
      exerciseId: r.exercise_id,
      exerciseName: r.exercise?.name ?? "Egzersiz",
      date: sessionDate.get(r.session_id) ?? period.start,
      weight: r.weight != null ? Number(r.weight) : null,
      reps: r.reps,
      rir: r.rir != null ? Number(r.rir) : null,
      region: r.exercise?.region ?? null,
      muscles: toMuscles(r.exercise?.exercise_muscle_targets ?? []),
    }));
  }

  let historyExerciseIds = new Set<string>();
  let prHistorySets: AggregateRows["prHistorySets"] = [];
  if (!opts.light && sets.length > 0) {
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
    const historyStart = toDateKey(
      subDays(parseDateKey(period.end), PR_HISTORY_DAYS),
    );
    const [{ data: priorExercises }, { data: prRows }] = await Promise.all([
      supabase
        .from("log_sets")
        .select("exercise_id, session:log_sessions!inner(athlete_id, session_date)")
        .eq("log_sessions.athlete_id", athleteId)
        .lt("log_sessions.session_date", period.start)
        .in("exercise_id", exerciseIds),
      supabase
        .from("log_sets")
        .select(
          "exercise_id, weight, reps, rir, exercise:exercises(name, region), session:log_sessions!inner(athlete_id, session_date)",
        )
        .eq("log_sessions.athlete_id", athleteId)
        .gte("log_sessions.session_date", historyStart)
        .lte("log_sessions.session_date", period.end)
        .in("exercise_id", exerciseIds),
    ]);

    type PriorRow = { exercise_id: string };
    historyExerciseIds = new Set(
      ((priorExercises ?? []) as PriorRow[]).map((r) => r.exercise_id),
    );

    type PrRow = {
      exercise_id: string;
      weight: number | null;
      reps: number | null;
      rir: number | null;
      exercise: { name: string; region: string | null } | null;
      session: { session_date: string } | null;
    };
    prHistorySets = ((prRows ?? []) as unknown as PrRow[])
      .filter((r) => r.session != null)
      .map((r) => ({
        exerciseId: r.exercise_id,
        exerciseName: r.exercise?.name ?? "Egzersiz",
        region: r.exercise?.region ?? null,
        date: r.session!.session_date,
        weight: r.weight != null ? Number(r.weight) : null,
        reps: r.reps,
        rir: r.rir != null ? Number(r.rir) : null,
      }));
  }

  // Per-day nutrition totals.
  const mealDayMap = new Map<
    string,
    { kcal: number; protein: number; carbs: number; fat: number }
  >();
  for (const m of meals ?? []) {
    const day =
      mealDayMap.get(m.meal_date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    day.kcal += m.kcal ?? 0;
    day.protein += m.protein ?? 0;
    day.carbs += m.carbs ?? 0;
    day.fat += m.fat ?? 0;
    mealDayMap.set(m.meal_date, day);
  }

  const activeProtocols = (assignments ?? []).filter(
    (a) => (a.protocol as { is_active: boolean } | null)?.is_active,
  ).length;
  const daysInPeriod =
    Math.round(
      (parseDateKey(period.end).getTime() - parseDateKey(period.start).getTime()) /
        86400000,
    ) + 1;

  return {
    sessions: sessionRows,
    sets,
    historyExerciseIds,
    prHistorySets,
    metricDays: (metrics ?? []).map((m) => ({
      date: m.metric_date,
      weight: m.weight != null ? Number(m.weight) : null,
      sleepHours: m.sleep_hours != null ? Number(m.sleep_hours) : null,
      restingHr: m.resting_hr,
      energy: m.energy,
      hunger: m.hunger,
      adherence: m.adherence,
      digestion: m.digestion,
      steps: m.steps,
      waterMl: m.water_ml,
    })),
    mealDays: [...mealDayMap.entries()].map(([date, v]) => ({ date, ...v })),
    target: target
      ? {
          kcal: target.kcal,
          protein: target.protein,
          carbs: target.carbs,
          fat: target.fat,
          waterMl: target.water_ml,
        }
      : null,
    cardio: (cardio ?? []).map((c) => ({
      minutes: c.duration_min,
      distanceKm: c.distance_km != null ? Number(c.distance_km) : null,
    })),
    protocol: {
      due: activeProtocols * daysInPeriod,
      done: completionCount ?? 0,
    },
    weeklyTargetDays: details?.weekly_target_days ?? null,
  };
}

/** The previous, equal-meaning window for trend comparison (null for milestones). */
function previousWindow(period: Period): { start: string; end: string } | null {
  if (period.type === "weekly") {
    return {
      start: toDateKey(subDays(parseDateKey(period.start), 7)),
      end: toDateKey(subDays(parseDateKey(period.start), 1)),
    };
  }
  if (period.type === "monthly") {
    const prevStart = addMonths(parseDateKey(period.start), -1);
    return {
      start: toDateKey(prevStart),
      end: toDateKey(subDays(parseDateKey(period.start), 1)),
    };
  }
  return null;
}

/** Nearest photo to `anchor` within ±tolerance days, or null. */
async function nearestPhoto(
  supabase: Client,
  athleteId: string,
  anchor: string,
  toleranceDays: number,
): Promise<{ id: string; photo_date: string; weight_kg: number | null } | null> {
  const from = toDateKey(subDays(parseDateKey(anchor), toleranceDays));
  const to = toDateKey(subDays(parseDateKey(anchor), -toleranceDays));
  const { data } = await supabase
    .from("physique_photos")
    .select("id, photo_date, weight_kg")
    .eq("athlete_id", athleteId)
    .gte("photo_date", from)
    .lte("photo_date", to);
  if (!data || data.length === 0) return null;
  const anchorTime = parseDateKey(anchor).getTime();
  const best = [...data].sort(
    (a, b) =>
      Math.abs(parseDateKey(a.photo_date).getTime() - anchorTime) -
      Math.abs(parseDateKey(b.photo_date).getTime() - anchorTime),
  )[0];
  return {
    id: best.id,
    photo_date: best.photo_date,
    weight_kg: best.weight_kg != null ? Number(best.weight_kg) : null,
  };
}

async function loadPhotoPair(
  supabase: Client,
  athleteId: string,
  period: Period,
): Promise<IssuePayload["photos"]> {
  if (period.type === "weekly") return null; // a week is no physique window
  const tolerance = PHOTO_TOLERANCE_DAYS[period.type];
  const [before, after] = await Promise.all([
    nearestPhoto(supabase, athleteId, period.start, tolerance),
    nearestPhoto(supabase, athleteId, period.end, tolerance),
  ]);
  // Both ends required, and the same photo can't play both roles.
  if (!before || !after || before.id === after.id) return null;
  return {
    beforeId: before.id,
    afterId: after.id,
    beforeDate: before.photo_date,
    afterDate: after.photo_date,
    beforeWeightKg: before.weight_kg,
    afterWeightKg: after.weight_kg,
  };
}

/**
 * Print every due issue for the athlete. Returns how many were printed.
 * Chronological (duePeriods is end-sorted), so issue numbers stay sequential.
 */
export async function generateDueIssues(
  supabase: Client,
  athleteId: string,
): Promise<number> {
  const journeyStart = await loadJourneyStart(supabase, athleteId);
  if (!journeyStart) return 0;

  const today = toDateKey(new Date());
  const { data: printedRows } = await supabase
    .from("report_issues")
    .select("period_type, period_end")
    .eq("athlete_id", athleteId);
  const printed = new Set(
    (printedRows ?? []).map((r) => `${r.period_type}:${r.period_end}`),
  );

  const due = duePeriods(journeyStart, today, printed);
  if (due.length === 0) return 0;

  const { data: details } = await supabase
    .from("profile_details")
    .select("goal")
    .eq("user_id", athleteId)
    .maybeSingle();
  const goal = (details?.goal ?? null) as TrainingGoal | null;

  // Per-type counts for sequential issue numbers.
  const counts = { weekly: 0, monthly: 0, milestone: 0 };
  for (const r of printedRows ?? []) {
    counts[r.period_type as keyof typeof counts] += 1;
  }

  let printedCount = 0;
  for (const period of due) {
    const [rows, prevRows, photos] = await Promise.all([
      loadAggregateRows(supabase, athleteId, period, { light: false }),
      (async () => {
        const prev = previousWindow(period);
        return prev
          ? loadAggregateRows(supabase, athleteId, prev, { light: true })
          : null;
      })(),
      loadPhotoPair(supabase, athleteId, period),
    ]);

    const current = aggregatePeriod(period, rows);
    let previous: PeriodAggregates | null = null;
    if (prevRows) {
      const prev = previousWindow(period)!;
      const prevAgg = aggregatePeriod({ ...period, ...prev } as Period, prevRows);
      // An entirely empty previous period is no comparator (no fake trends).
      previous =
        prevAgg.totalSets > 0 ||
        prevAgg.sessionsCompleted > 0 ||
        prevAgg.weightSamples > 0 ||
        prevAgg.nutritionDaysLogged > 0
          ? prevAgg
          : null;
    }

    const payload = buildIssue(
      {
        seed: `${athleteId}:${period.type}:${period.end}`,
        periodType: period.type,
        photos,
        nextMilestone: nextMilestone(journeyStart, period.end),
      },
      { goal, periodType: period.type, current, previous },
    );
    if (!payload) continue; // empty period: no issue, honestly

    counts[period.type] += 1;
    const { error } = await supabase.from("report_issues").insert({
      athlete_id: athleteId,
      period_type: period.type,
      period_start: period.start,
      period_end: period.end,
      milestone_months: period.type === "milestone" ? period.months : null,
      issue_number: counts[period.type],
      payload: payload as never,
    });
    if (error) {
      // 23505: a parallel tab printed this period first — that copy wins.
      if (error.code !== "23505") throw error;
      counts[period.type] -= 1;
      continue;
    }
    printedCount += 1;
  }
  return printedCount;
}
