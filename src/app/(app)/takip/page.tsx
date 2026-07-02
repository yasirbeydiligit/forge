import type { Metadata } from "next";
import Link from "next/link";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MetricRow, type CellConfig } from "./metric-row";
import { TrackerSettingsDialog } from "./settings-dialog";
import { LabHeader, LabPage, PaperCard, SectionLabel } from "@/components/lab/lab";
import { InsightNotes } from "@/components/library/insight-note";
import { MeasureCard } from "@/components/measure-card";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { toDateKey, WEEKDAY_LABELS } from "@/lib/format";
import {
  computeBaseline,
  getMetric,
  metricCenter,
  parseGoals,
  resolveEnabled,
  valence,
  weightPolarityForGoal,
  type MetricKey,
} from "@/lib/metrics";
import { getAthleteInsights } from "@/lib/rag/insights-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DailyMetric } from "@/lib/types";

export const metadata: Metadata = { title: "Günlük Takip" };

/** Days of history before the shown week used to build each metric's baseline. */
const BASELINE_WINDOW_DAYS = 28;

const num = (v: unknown): number | null =>
  v != null && Number.isFinite(Number(v)) ? Number(v) : null;

/** Average value cards show 1 decimal, except whole-number metrics. */
function formatAvg(key: MetricKey, n: number): string {
  if (key === "steps") return Math.round(n).toLocaleString("tr-TR");
  return key === "resting_hr" ? String(Math.round(n)) : n.toFixed(1);
}

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const profile = await requireProfile();
  const { week } = await searchParams;

  const base =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? parseISO(week) : new Date();
  const weekStart = startOfWeek(base, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startKey = toDateKey(weekStart);
  const endKey = toDateKey(days[6]);
  const baselineStartKey = toDateKey(subDays(weekStart, BASELINE_WINDOW_DAYS));
  const prevKey = toDateKey(subWeeks(weekStart, 1));
  const nextKey = toDateKey(addWeeks(weekStart, 1));
  const rangeLabel = `${format(weekStart, "d", { locale: tr })}–${format(days[6], "d MMMM", { locale: tr })}`;

  const supabase = await createSupabaseServerClient();

  // One read covers both the visible week and the trailing baseline window.
  const [{ data: rows }, { data: settings }, { data: details }] =
    await Promise.all([
      supabase
        .from("daily_metrics")
        .select("*")
        .eq("athlete_id", profile.id)
        .gte("metric_date", baselineStartKey)
        .lte("metric_date", endKey),
      supabase
        .from("tracker_settings")
        .select("enabled, goals")
        .eq("athlete_id", profile.id)
        .maybeSingle(),
      supabase
        .from("profile_details")
        .select("goal")
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

  const allRows = (rows ?? []) as DailyMetric[];
  const weekRows = allRows.filter(
    (m) => m.metric_date >= startKey && m.metric_date <= endKey,
  );
  // Strictly before the week → a stable baseline shared by every day shown.
  const historyRows = allRows.filter((m) => m.metric_date < startKey);
  const byDate = new Map<string, DailyMetric>(
    weekRows.map((m) => [m.metric_date, m]),
  );

  const enabled = resolveEnabled(settings?.enabled);
  const goals = parseGoals(settings?.goals);
  const numericCols = enabled.filter((k) => k !== "notes");

  // Per-metric colouring context, computed once from the trailing history.
  const configs: Partial<Record<MetricKey, CellConfig>> = {};
  for (const key of numericCols) {
    const def = getMetric(key);
    const history = historyRows
      .map((m) => num(m[key]))
      .filter((v): v is number => v != null);
    const baseline = computeBaseline(history, def.spreadFloor);
    // The profile goal gives weight a direction (fat_loss ↓ good, muscle_gain
    // ↑ good). Judged against the athlete's own recent mean — "moving the
    // right way" is the signal, not distance from a target weight.
    const polarity =
      key === "weight"
        ? weightPolarityForGoal(details?.goal ?? null)
        : def.polarity;
    const center =
      key === "weight" && polarity !== "trend"
        ? baseline.mean
        : metricCenter(baseline, goals[key]);
    configs[key] = { polarity, center, spread: baseline.spread };
  }

  const weekValues = (key: MetricKey) =>
    days
      .map((d) => num(byDate.get(toDateKey(d))?.[key]))
      .filter((v): v is number => v != null);

  const insights = await getAthleteInsights(supabase, profile.id, "recovery");

  return (
    <LabPage>
      <LabHeader
        metaLeft="Günlük takip"
        metaRight={`Hafta ${rangeLabel}`}
        title="Günlük takip"
        subtitle="Kilo, uyku, nabız ve hislerini gün gün işle."
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="font-serif text-lg capitalize text-lab-ink">{rangeLabel}</p>
        <div className="flex items-center gap-1">
          <TrackerSettingsDialog enabled={enabled} goals={goals} />
          <Button asChild variant="outline" size="icon">
            <Link href={`/takip?week=${prevKey}`} aria-label="Önceki hafta">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={`/takip?week=${nextKey}`} aria-label="Sonraki hafta">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <PaperCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem]">
            <thead>
              <tr className="border-b border-paper-border text-[10px] font-semibold uppercase text-paper-muted">
                <th className="py-2 pl-3 text-left">Gün</th>
                {numericCols.map((key) => (
                  <th key={key} className="py-2 text-center">
                    {getMetric(key).short}
                  </th>
                ))}
                {enabled.includes("notes") ? (
                  <th className="py-2 pl-2 text-left">Not</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const key = toDateKey(d);
                return (
                  <MetricRow
                    key={key}
                    date={key}
                    dayLabel={WEEKDAY_LABELS[i]}
                    dayNum={d.getDate()}
                    isToday={isSameDay(d, new Date())}
                    metric={byDate.get(key) ?? null}
                    columns={enabled}
                    configs={configs}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </PaperCard>

      <section className="mt-8 space-y-3">
        <SectionLabel>Bu hafta</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {numericCols.map((key) => {
            const def = getMetric(key);
            const xs = weekValues(key);
            const avg = xs.length
              ? xs.reduce((a, b) => a + b, 0) / xs.length
              : null;
            const cfg = configs[key];

            // Reflect the week average's valence on the card (calm by default;
            // only real deviations get an accent). Weight is trend-only.
            const v =
              avg != null && cfg ? valence(avg, cfg) : "none";
            const accent =
              v === "good" ? "green" : v === "bad" ? "rose" : "green";
            const emphasis = v === "good" || v === "bad";

            const goal = goals[key];
            const hint =
              def.polarity === "trend" && goal != null && avg != null
                ? `Hedefe ${Math.abs(avg - goal).toFixed(1)} ${def.unit ?? ""}`.trim()
                : undefined;

            return (
              <MeasureCard
                key={key}
                label={`Ort. ${def.label.toLowerCase()}`}
                value={avg != null ? formatAvg(key, avg) : "—"}
                unit={def.unit ?? undefined}
                points={xs}
                accent={accent}
                emphasis={emphasis}
                hint={hint}
              />
            );
          })}
        </div>

        <InsightNotes insights={insights} className="space-y-3" />
      </section>
    </LabPage>
  );
}
