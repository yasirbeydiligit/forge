import type { Metadata } from "next";
import Link from "next/link";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MetricRow } from "./metric-row";
import { LabHeader, LabPage, PaperCard, SectionLabel } from "@/components/lab/lab";
import { InsightNotes } from "@/components/library/insight-note";
import { Sparkline } from "@/components/logbook/sparkline";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { toDateKey, WEEKDAY_LABELS } from "@/lib/format";
import { getAthleteInsights } from "@/lib/rag/insights-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DailyMetric } from "@/lib/types";

export const metadata: Metadata = { title: "Günlük Takip" };

type NumKey =
  | "weight"
  | "sleep_hours"
  | "resting_hr"
  | "energy"
  | "hunger"
  | "adherence";

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
  const prevKey = toDateKey(subWeeks(weekStart, 1));
  const nextKey = toDateKey(addWeeks(weekStart, 1));
  const rangeLabel = `${format(weekStart, "d", { locale: tr })}–${format(days[6], "d MMMM", { locale: tr })}`;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("daily_metrics")
    .select("*")
    .eq("athlete_id", profile.id)
    .gte("metric_date", startKey)
    .lte("metric_date", endKey);

  const byDate = new Map<string, DailyMetric>(
    (data ?? []).map((m) => [m.metric_date, m]),
  );

  const insights = await getAthleteInsights(supabase, profile.id, "recovery");

  const valuesOf = (key: NumKey) =>
    days
      .map((d) => byDate.get(toDateKey(d))?.[key])
      .filter((v): v is number => v != null)
      .map(Number);
  const avgOf = (key: NumKey) => {
    const xs = valuesOf(key);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };

  const avgWeight = avgOf("weight");
  const avgSleep = avgOf("sleep_hours");
  const avgHr = avgOf("resting_hr");
  const avgEnergy = avgOf("energy");
  const avgHunger = avgOf("hunger");
  const avgAdh = avgOf("adherence");

  return (
    <LabPage>
      <LabHeader
        metaLeft="Günlük takip"
        metaRight={`Hafta ${rangeLabel}`}
        title="Günlük takip"
        subtitle="Kilo, uyku, nabız ve hislerini gün gün işle."
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="font-serif text-lg capitalize text-lab-ink">{rangeLabel}</p>
        <div className="flex gap-1">
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
                <th className="py-2 text-center">Kilo</th>
                <th className="py-2 text-center">Uyku</th>
                <th className="py-2 text-center">RHR</th>
                <th className="py-2 text-center">Enerji</th>
                <th className="py-2 text-center">Açlık</th>
                <th className="py-2 text-center">Uyum</th>
                <th className="py-2 pl-2 text-left">Not</th>
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
          <AverageCard
            label="Ort. kilo"
            value={avgWeight != null ? avgWeight.toFixed(1) : "—"}
            unit="kg"
            points={valuesOf("weight")}
          />
          <AverageCard
            label="Ort. uyku"
            value={avgSleep != null ? avgSleep.toFixed(1) : "—"}
            unit="s"
            points={valuesOf("sleep_hours")}
          />
          <AverageCard
            label="Ort. RHR"
            value={avgHr != null ? String(Math.round(avgHr)) : "—"}
            unit="bpm"
            points={valuesOf("resting_hr")}
          />
          <AverageCard
            label="Ort. enerji"
            value={avgEnergy != null ? avgEnergy.toFixed(1) : "—"}
            unit="/10"
            points={valuesOf("energy")}
          />
          <AverageCard
            label="Ort. açlık"
            value={avgHunger != null ? avgHunger.toFixed(1) : "—"}
            unit="/10"
            points={valuesOf("hunger")}
          />
          <AverageCard
            label="Ort. uyum"
            value={avgAdh != null ? avgAdh.toFixed(1) : "—"}
            unit="/10"
            points={valuesOf("adherence")}
          />
        </div>

        <InsightNotes insights={insights} className="space-y-3" />
      </section>
    </LabPage>
  );
}

function AverageCard({
  label,
  value,
  unit,
  points,
}: {
  label: string;
  value: string;
  unit: string;
  points: number[];
}) {
  return (
    <PaperCard className="p-4">
      <SectionLabel className="text-paper-muted">{label}</SectionLabel>
      <p className="mt-1 font-serif text-2xl tabular-nums text-paper-foreground">
        {value}
        <span className="ml-1 text-sm font-normal text-paper-muted">{unit}</span>
      </p>
      <div className="mt-2">
        <Sparkline points={points} width={120} height={24} />
      </div>
    </PaperCard>
  );
}
