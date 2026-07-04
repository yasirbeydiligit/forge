/**
 * Pure summariser over a trailing window of `daily_metrics` rows for the Bugün
 * page. One read pulls ~2 weeks; each metric box derives its today value, its
 * latest known value + signed delta, and a chronological series for a sparkline.
 * Framework-free and tolerant of PG numerics (arrive as strings) and nulls.
 */

export type MetricRow = { metric_date: string } & Record<string, unknown>;

export type MetricSummary = {
  /** Most recent non-null value in the window (weight isn't logged daily). */
  latest: number | null;
  latestDate: string | null;
  /** The non-null value just before `latest` (for the delta). */
  previous: number | null;
  /** latest − previous, or null when there is no prior value. */
  delta: number | null;
  /** Value logged exactly on `todayKey`, or null (for daily metrics like steps). */
  todayValue: number | null;
  /** Chronological non-null values — feed straight to a sparkline. */
  series: number[];
};

const finite = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function summarizeMetric(
  rows: readonly MetricRow[],
  field: string,
  todayKey: string,
): MetricSummary {
  const sorted = [...rows].sort((a, b) =>
    a.metric_date < b.metric_date ? -1 : a.metric_date > b.metric_date ? 1 : 0,
  );

  const points: { date: string; value: number }[] = [];
  let todayValue: number | null = null;
  for (const r of sorted) {
    const v = finite(r[field]);
    if (v == null) continue;
    points.push({ date: r.metric_date, value: v });
    if (r.metric_date === todayKey) todayValue = v;
  }

  const last = points.at(-1) ?? null;
  const prev = points.at(-2) ?? null;

  return {
    latest: last?.value ?? null,
    latestDate: last?.date ?? null,
    previous: prev?.value ?? null,
    delta: last && prev ? last.value - prev.value : null,
    todayValue,
    series: points.map((p) => p.value),
  };
}
