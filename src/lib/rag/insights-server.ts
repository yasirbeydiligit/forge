/**
 * Server side of the rule-based insight engine.
 *
 * This module loads enabled `insight_rules`, computes ONLY the metrics those
 * rules reference (the "metric vocabulary" below), evaluates them with the PURE
 * `evaluateRules` (see ./insights.ts), then resolves each fired rule's pinned
 * library chunk into a citation. It is LLM-FREE: NO Voyage / Anthropic calls.
 *
 * It is kept OUT of insights.ts (the unit-tested pure module) because it touches
 * the request-scoped Supabase client (which is bound to `next/headers`). This
 * mirrors the request.ts / actions.ts split in `src/app/(app)/kutuphane`.
 *
 * The Supabase client carries the signed-in user's JWT, so RLS is the source of
 * truth: an athlete's meals / daily_metrics / log_* rows are already restricted
 * to themselves. We still pass `athleteId` explicitly so a coach-context client
 * (future) reads the right athlete and the queries are self-documenting.
 *
 * Resilience: any metric-source error makes that metric `null` (the rule simply
 * doesn't fire); `getAthleteInsights` never throws out of a missing data source.
 */

import { subDays } from "date-fns";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { toDateKey } from "@/lib/format";
import {
  setsAvgRir,
  setsCount,
  type HistorySetRow,
} from "@/lib/logbook-stats";

import { evaluateRules, type InsightRule } from "./insights";

type Supabase = SupabaseClient<Database>;

/**
 * METRIC VOCABULARY — the keys an `insight_rules.metric` may reference. Each is
 * a number (or null when the underlying data is missing). Authors of rules pick
 * one of these keys; anything else simply never resolves to a value (so the
 * rule never fires). All windows are "last N days" ending today (inclusive).
 *
 *  - `protein_per_bw_7d`  protein-per-bodyweight (g/kg), 7-day average:
 *        avg daily protein (g) over the last 7 days ÷ latest bodyweight (kg).
 *        null if there is no bodyweight or no meals in the window.
 *  - `sleep_hours_7d`     average nightly sleep (hours) over the last 7 days
 *        (daily_metrics.sleep_hours). null if no sleep entries in the window.
 *  - `volume_wow_pct`     week-over-week total training-volume change (%):
 *        ((this 7d volume − previous 7d volume) / previous 7d volume) × 100,
 *        using sum(weight × reps) across all logged sets. null if there is no
 *        previous-week volume to compare against (avoids divide-by-zero).
 *  - `rir_7d`             average set RIR over the last 7 days
 *        (log_sets.rir joined to log_sessions.session_date). null if no RIR.
 *        NOTE: RIR is inverse to effort — a LOW value means close to failure.
 */
export const METRIC_KEYS = [
  "protein_per_bw_7d",
  "sleep_hours_7d",
  "volume_wow_pct",
  "rir_7d",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type AthleteInsight = {
  key: string;
  scope: string | null;
  text: string;
  citation: {
    documentId: string;
    chunkId: string;
    pageNumber: number | null;
    title: string;
    quote: string;
  } | null;
};

const QUOTE_MAX = 160;

/** Map an `insight_rules` row to the camelCase InsightRule the evaluator wants. */
function toInsightRule(row: Database["public"]["Tables"]["insight_rules"]["Row"]): InsightRule {
  return {
    key: row.key,
    metric: row.metric,
    comparator: row.comparator,
    threshold: row.threshold,
    scope: row.scope,
    retrievalQuery: row.retrieval_query,
    pinnedChunkId: row.pinned_chunk_id,
    noteTemplate: row.note_template,
    enabled: row.enabled,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Metric computations ─────────────────────────────────────────────────────
// Each computer returns a number or null and NEVER throws (errors → null), so a
// failing data source just means the dependent rules don't fire.

/**
 * protein-per-bodyweight (g/kg), 7-day average. Avg daily protein over the last
 * 7 days ÷ the latest recorded bodyweight. We average per-DAY protein totals
 * (not per-meal) so days with many meals don't skew the mean.
 */
async function proteinPerBodyweight7d(
  supabase: Supabase,
  athleteId: string,
  today: Date,
): Promise<number | null> {
  try {
    const since = toDateKey(subDays(today, 6));
    const until = toDateKey(today);

    const [{ data: meals }, { data: bwRows }] = await Promise.all([
      supabase
        .from("meals")
        .select("meal_date, protein")
        .eq("athlete_id", athleteId)
        .gte("meal_date", since)
        .lte("meal_date", until),
      supabase
        .from("daily_metrics")
        .select("metric_date, weight")
        .eq("athlete_id", athleteId)
        .not("weight", "is", null)
        .order("metric_date", { ascending: false })
        .limit(1),
    ]);

    const bodyweight = bwRows?.[0]?.weight;
    if (bodyweight == null || Number(bodyweight) <= 0) return null;
    if (!meals || meals.length === 0) return null;

    // Sum protein per day, then average the daily totals over the window.
    const perDay = new Map<string, number>();
    for (const m of meals) {
      perDay.set(m.meal_date, (perDay.get(m.meal_date) ?? 0) + Number(m.protein ?? 0));
    }
    const avgDailyProtein = average([...perDay.values()]);
    if (avgDailyProtein == null) return null;

    return avgDailyProtein / Number(bodyweight);
  } catch {
    return null;
  }
}

/** average nightly sleep (hours), 7-day window. */
async function sleepHours7d(
  supabase: Supabase,
  athleteId: string,
  today: Date,
): Promise<number | null> {
  try {
    const since = toDateKey(subDays(today, 6));
    const until = toDateKey(today);
    const { data } = await supabase
      .from("daily_metrics")
      .select("sleep_hours")
      .eq("athlete_id", athleteId)
      .gte("metric_date", since)
      .lte("metric_date", until)
      .not("sleep_hours", "is", null);

    const values = (data ?? [])
      .map((r) => r.sleep_hours)
      .filter((v): v is number => v != null)
      .map(Number);
    return average(values);
  } catch {
    return null;
  }
}

/**
 * Fetch the athlete's logged sets (with session_date) over the last 14 days,
 * flattened to the HistorySetRow shape that logbook-stats consumes. Shared by
 * the volume-WoW and RIR metrics so we only hit the DB once.
 */
async function recentHistoryRows(
  supabase: Supabase,
  athleteId: string,
  today: Date,
): Promise<HistorySetRow[]> {
  const since = toDateKey(subDays(today, 13));
  const { data } = await supabase
    .from("log_sets")
    .select(
      "weight, reps, rir, set_number, exercise_id, created_at, session:log_sessions!inner(session_date, athlete_id)",
    )
    .eq("session.athlete_id", athleteId)
    .gte("session.session_date", since);

  const rows = (data ?? []) as unknown as (Omit<HistorySetRow, "session_date"> & {
    session: { session_date: string } | null;
  })[];

  return rows
    .filter((r) => r.session)
    .map((r) => ({ ...r, session_date: r.session!.session_date }));
}

/**
 * week-over-week training-volume change (%), where volume is SET COUNT (this
 * product never measures tonnage). Compares this 7-day set count against the
 * previous 7-day set count. null when there's no previous-week volume (can't
 * compute a percentage from zero).
 */
function volumeWowPct(rows: HistorySetRow[], today: Date): number | null {
  const thisStart = subDays(today, 6).getTime();
  const prevStart = subDays(today, 13).getTime();
  const prevEnd = subDays(today, 7).getTime();

  const thisWeek: HistorySetRow[] = [];
  const prevWeek: HistorySetRow[] = [];
  for (const r of rows) {
    const t = new Date(r.session_date).getTime();
    if (t >= thisStart) thisWeek.push(r);
    else if (t >= prevStart && t <= prevEnd) prevWeek.push(r);
  }

  const prevVolume = setsCount(prevWeek);
  if (prevVolume <= 0) return null;
  const thisVolume = setsCount(thisWeek);
  return ((thisVolume - prevVolume) / prevVolume) * 100;
}

/**
 * average set RIR over the last 7 days. Reuses logbook-stats' `setsAvgRir`
 * (the same mean-RIR math behind the workout day page's `avgRir4w`), windowed
 * to the trailing 7 days.
 */
function rir7d(rows: HistorySetRow[], today: Date): number | null {
  const since = subDays(today, 6).getTime();
  const inWindow = rows.filter(
    (r) => new Date(r.session_date).getTime() >= since,
  );
  return setsAvgRir(inWindow);
}

/**
 * Compute only the metrics in `needed`. Unknown keys are ignored. Each value is
 * a number or null; any source error already collapses to null inside the
 * per-metric computers.
 */
async function computeMetrics(
  supabase: Supabase,
  athleteId: string,
  needed: Set<string>,
  today: Date,
): Promise<Record<string, number | null>> {
  const metrics: Record<string, number | null> = {};

  const wantsHistory =
    needed.has("volume_wow_pct") || needed.has("rir_7d");

  const [protein, sleep, history] = await Promise.all([
    needed.has("protein_per_bw_7d")
      ? proteinPerBodyweight7d(supabase, athleteId, today)
      : Promise.resolve(null),
    needed.has("sleep_hours_7d")
      ? sleepHours7d(supabase, athleteId, today)
      : Promise.resolve(null),
    wantsHistory
      ? recentHistoryRows(supabase, athleteId, today).catch(
          () => [] as HistorySetRow[],
        )
      : Promise.resolve([] as HistorySetRow[]),
  ]);

  if (needed.has("protein_per_bw_7d")) metrics.protein_per_bw_7d = protein;
  if (needed.has("sleep_hours_7d")) metrics.sleep_hours_7d = sleep;
  if (needed.has("volume_wow_pct")) {
    metrics.volume_wow_pct = volumeWowPct(history, today);
  }
  if (needed.has("rir_7d")) metrics.rir_7d = rir7d(history, today);

  return metrics;
}

/**
 * Resolve pinned chunk IDs into citations in a single round-trip:
 * fetch the chunks (content, page, document_id) and their document titles.
 * Returns a map chunkId → citation parts; missing chunks are simply absent.
 */
async function resolveCitations(
  supabase: Supabase,
  chunkIds: string[],
): Promise<Map<string, AthleteInsight["citation"]>> {
  const out = new Map<string, AthleteInsight["citation"]>();
  if (chunkIds.length === 0) return out;

  try {
    const { data } = await supabase
      .from("document_chunks")
      .select(
        "id, content, page_number, document_id, document:library_documents(title)",
      )
      .in("id", chunkIds);

    for (const row of data ?? []) {
      const r = row as unknown as {
        id: string;
        content: string;
        page_number: number | null;
        document_id: string;
        document: { title: string } | { title: string }[] | null;
      };
      const doc = Array.isArray(r.document) ? r.document[0] : r.document;
      out.set(r.id, {
        documentId: r.document_id,
        chunkId: r.id,
        pageNumber: r.page_number,
        title: doc?.title ?? "",
        quote: (r.content ?? "").slice(0, QUOTE_MAX),
      });
    }
  } catch {
    // Citation resolution is best-effort; on failure the notes still render
    // with a null citation.
  }

  return out;
}

/**
 * Compute the athlete's woven-in insights.
 *
 * 1. Load ENABLED `insight_rules` (filtered by `scope` when provided).
 * 2. Compute only the metrics those rules reference.
 * 3. Evaluate the rules (pure) → fired rules with rendered note text.
 * 4. Resolve each fired rule's pinned chunk into a citation.
 *
 * Returns `AthleteInsight[]`. DECISION: a fired note is ALWAYS returned even if
 * its citation can't be resolved (citation: null) — the science statement is
 * still useful. Rules with only a `retrieval_query` and no pinned chunk also
 * return with citation null (the dynamic-retrieval path is a future TODO; we do
 * NOT call Voyage here).
 *
 * Never throws on a missing data source: a query failure makes the dependent
 * metric null (so its rules don't fire) rather than propagating.
 */
export async function getAthleteInsights(
  supabase: Supabase,
  athleteId: string,
  scope?: string,
  now: Date = new Date(),
): Promise<AthleteInsight[]> {
  // 1) Load enabled rules (optionally scoped).
  let query = supabase.from("insight_rules").select("*").eq("enabled", true);
  if (scope) query = query.eq("scope", scope);

  let ruleRows: Database["public"]["Tables"]["insight_rules"]["Row"][] = [];
  try {
    const { data } = await query;
    ruleRows = data ?? [];
  } catch {
    return [];
  }
  if (ruleRows.length === 0) return [];

  const rules = ruleRows.map(toInsightRule);

  // 2) Compute only the metrics the loaded rules actually reference.
  const needed = new Set(rules.map((r) => r.metric));
  const metrics = await computeMetrics(supabase, athleteId, needed, now);

  // 3) Evaluate (pure).
  const fired = evaluateRules(rules, metrics);
  if (fired.length === 0) return [];

  // 4) Resolve pinned-chunk citations in one round-trip.
  const pinnedIds = [
    ...new Set(
      fired
        .map((f) => f.pinnedChunkId)
        .filter((id): id is string => id != null),
    ),
  ];
  const citations = await resolveCitations(supabase, pinnedIds);

  // TODO(retrieval): rules with only a retrievalQuery (no pinnedChunkId) could
  // resolve a citation via the embedding search at author time. v1 is the
  // pinned path; we deliberately do NOT call Voyage at render time.
  return fired.map((f) => ({
    key: f.key,
    scope: f.scope,
    text: f.text,
    citation: f.pinnedChunkId
      ? (citations.get(f.pinnedChunkId) ?? null)
      : null,
  }));
}
