/**
 * Server-side batched loader for the coach triage board. Fetches every input
 * table ONCE for all athletes (no per-athlete queries — flat ~10 queries no
 * matter the roster size), groups rows per athlete, and runs the pure engine
 * (detectAlerts → filterDismissed → computeTriage).
 *
 * Wrapped in React cache() so the app layout (nav badge) and the panel page
 * share a single computation per request. Coach read access is enforced by
 * RLS — the same tables the athlete-detail page already reads.
 */
import { cache } from "react";
import { format, subDays } from "date-fns";

import type { PlateauSessionStat } from "@/lib/reports/plateau";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { detectAlerts } from "./alerts";
import { DEFAULT_TRIAGE_CONFIG } from "./config";
import { computeTriage, filterDismissed, sortTriage } from "./score";
import type { AlertDismissal, TriageInput, TriageResult } from "./types";

/** Look-back windows (days). Plateau needs the longest history. */
const SESSION_WINDOW = 35;
const PLATEAU_WINDOW = 28;
const MEAL_WINDOW = 14;
const METRIC_WINDOW = 28;

export type TriageSnapshot = {
  /** Worst first. */
  results: TriageResult[];
  /** Athletes with at least one open alert. */
  attentionCount: number;
  /** Athletes whose worst open alert is critical. */
  criticalCount: number;
  today: string;
};

type SetRow = {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  exercise_id: string;
  exercise: { name: string } | null;
  session: { id: string; athlete_id: string; session_date: string } | null;
};

export const loadTriage = cache(async (): Promise<TriageSnapshot> => {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const cutoff = (days: number) => format(subDays(now, days), "yyyy-MM-dd");

  const [
    { data: athletes },
    { data: details },
    { data: sessions },
    { data: sets },
    { data: meals },
    { data: metrics },
    { data: targets },
    { data: assignments },
    { data: completions },
    { data: dismissalRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, created_at")
      .eq("role", "athlete"),
    supabase.from("profile_details").select("user_id, goal"),
    supabase
      .from("log_sessions")
      .select("athlete_id, session_date")
      .gte("session_date", cutoff(SESSION_WINDOW)),
    supabase
      .from("log_sets")
      .select(
        "weight, reps, rir, exercise_id, exercise:exercises(name), session:log_sessions!inner(id, athlete_id, session_date)",
      )
      .gte("log_sessions.session_date", cutoff(PLATEAU_WINDOW)),
    supabase
      .from("meals")
      .select("athlete_id, meal_date, protein")
      .gte("meal_date", cutoff(MEAL_WINDOW)),
    supabase
      .from("daily_metrics")
      .select("athlete_id, metric_date, weight")
      .gte("metric_date", cutoff(METRIC_WINDOW)),
    supabase.from("nutrition_targets").select("athlete_id, protein"),
    supabase.from("protocol_assignments").select("athlete_id"),
    supabase
      .from("protocol_completions")
      .select("athlete_id, completion_date")
      .gte("completion_date", cutoff(DEFAULT_TRIAGE_CONFIG.protocolWindowDays)),
    supabase.from("alert_dismissals").select("athlete_id, alert_key, fingerprint"),
  ]);

  // ---- Group every table by athlete ----------------------------------------
  const inputs = new Map<string, TriageInput>();
  for (const a of athletes ?? []) {
    inputs.set(a.id, {
      athleteId: a.id,
      fullName: a.full_name,
      avatarUrl: a.avatar_url,
      joinedAt: a.created_at,
      goal: null,
      sessionDates: [],
      plateau: {},
      mealDays: [],
      proteinTarget: null,
      metricDays: [],
      protocolAssigned: 0,
      protocolCompletions: [],
      rirSessions: [],
    });
  }
  const get = (athleteId: string) => inputs.get(athleteId);

  for (const d of details ?? []) {
    const input = get(d.user_id);
    if (input) input.goal = d.goal;
  }
  for (const s of sessions ?? []) {
    get(s.athlete_id)?.sessionDates.push(s.session_date);
  }

  // Meals: fold to per-day protein sums.
  const mealDayKey = new Map<string, { date: string; protein: number }>();
  for (const m of meals ?? []) {
    const input = get(m.athlete_id);
    if (!input) continue;
    const key = `${m.athlete_id}\n${m.meal_date}`;
    let day = mealDayKey.get(key);
    if (!day) {
      day = { date: m.meal_date, protein: 0 };
      mealDayKey.set(key, day);
      input.mealDays.push(day);
    }
    day.protein += m.protein ?? 0;
  }

  for (const m of metrics ?? []) {
    get(m.athlete_id)?.metricDays.push({
      date: m.metric_date,
      weight: m.weight != null ? Number(m.weight) : null,
    });
  }
  for (const t of targets ?? []) {
    const input = get(t.athlete_id);
    if (input) input.proteinTarget = t.protein;
  }
  for (const a of assignments ?? []) {
    const input = get(a.athlete_id);
    if (input) input.protocolAssigned += 1;
  }
  for (const c of completions ?? []) {
    get(c.athlete_id)?.protocolCompletions.push({ date: c.completion_date });
  }

  // Sets feed two signals: per-exercise plateau stats and per-session RIR.
  const rirAcc = new Map<
    string,
    { athleteId: string; date: string; rirSum: number; setCount: number }
  >();
  for (const raw of (sets ?? []) as unknown as SetRow[]) {
    const session = raw.session;
    if (!session) continue;
    const input = get(session.athlete_id);
    if (!input) continue;

    if (raw.weight != null && raw.reps != null) {
      const entry = (input.plateau[raw.exercise_id] ??= {
        exerciseName: raw.exercise?.name ?? "Egzersiz",
        stats: [],
      });
      const rir = raw.rir != null ? Number(raw.rir) : null;
      const w = Number(raw.weight);
      const existing = entry.stats.find((s) => s.date === session.session_date);
      if (!existing) {
        entry.stats.push({
          date: session.session_date,
          topWeight: w,
          topReps: raw.reps,
          bestRir: rir,
        } satisfies PlateauSessionStat);
      } else {
        existing.topWeight = Math.max(existing.topWeight, w);
        existing.topReps = Math.max(existing.topReps, raw.reps);
        if (rir != null) {
          existing.bestRir =
            existing.bestRir == null ? rir : Math.min(existing.bestRir, rir);
        }
      }
    }

    if (raw.rir != null) {
      const acc = rirAcc.get(session.id) ?? {
        athleteId: session.athlete_id,
        date: session.session_date,
        rirSum: 0,
        setCount: 0,
      };
      acc.rirSum += Number(raw.rir);
      acc.setCount += 1;
      rirAcc.set(session.id, acc);
    }
  }
  for (const acc of rirAcc.values()) {
    get(acc.athleteId)?.rirSessions.push({
      date: acc.date,
      avgRir: acc.rirSum / acc.setCount,
      setCount: acc.setCount,
    });
  }

  // ---- Run the pure engine --------------------------------------------------
  const dismissals: AlertDismissal[] = (dismissalRows ?? []).map((d) => ({
    athleteId: d.athlete_id,
    alertKey: d.alert_key,
    fingerprint: d.fingerprint,
  }));

  const results = sortTriage(
    [...inputs.values()].map((input) => {
      const alerts = detectAlerts(input, DEFAULT_TRIAGE_CONFIG, today);
      const open = filterDismissed(alerts, dismissals, input.athleteId);
      return computeTriage(input, open, DEFAULT_TRIAGE_CONFIG);
    }),
  );

  return {
    results,
    attentionCount: results.filter((r) => r.alerts.length > 0).length,
    criticalCount: results.filter((r) => r.band === "red").length,
    today,
  };
});

/** Triage for a single athlete, sharing the request-level cache. */
export async function loadTriageForAthlete(
  athleteId: string,
): Promise<TriageResult | null> {
  const { results } = await loadTriage();
  return results.find((r) => r.athleteId === athleteId) ?? null;
}
