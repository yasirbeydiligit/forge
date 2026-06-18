import type { Metadata } from "next";
import Link from "next/link";
import { LineChart as LineChartIcon, Trophy } from "lucide-react";

import { ProgressChartLazy, type ProgressPoint } from "./progress-chart-lazy";
import { PaperCard } from "@/components/lab/lab";
import { EmptyState } from "@/components/empty-state";
import { MeasureCard } from "@/components/measure-card";
import { PageHeader } from "@/components/shell/page-header";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "İlerleme" };

type SessionWithSets = {
  session_date: string;
  log_sets: {
    weight: number | null;
    reps: number | null;
    exercise_id: string;
    exercise: { name: string } | null;
  }[];
};

type ExerciseProgress = {
  id: string;
  name: string;
  pr: number;
  totalSets: number;
  byDate: Map<string, number>; // date -> best weight
};

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ ex?: string }>;
}) {
  const profile = await requireProfile();
  const { ex } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("log_sessions")
    .select(
      "session_date, log_sets(weight, reps, exercise_id, exercise:exercises(name))",
    )
    .eq("athlete_id", profile.id)
    .order("session_date", { ascending: true });

  const sessions = (data ?? []) as unknown as SessionWithSets[];

  const progress = new Map<string, ExerciseProgress>();
  for (const session of sessions) {
    for (const set of session.log_sets ?? []) {
      if (set.weight == null) continue;
      let entry = progress.get(set.exercise_id);
      if (!entry) {
        entry = {
          id: set.exercise_id,
          name: set.exercise?.name ?? "Egzersiz",
          pr: 0,
          totalSets: 0,
          byDate: new Map(),
        };
        progress.set(set.exercise_id, entry);
      }
      entry.totalSets += 1;
      entry.pr = Math.max(entry.pr, set.weight);
      entry.byDate.set(
        session.session_date,
        Math.max(entry.byDate.get(session.session_date) ?? 0, set.weight),
      );
    }
  }

  const exercises = [...progress.values()].sort(
    (a, b) => b.totalSets - a.totalSets,
  );

  if (exercises.length === 0) {
    return (
      <div>
        <PageHeader
          title="İlerleme"
          description="Egzersizlerindeki gelişimini takip et."
        />
        <EmptyState
          icon={LineChartIcon}
          title="Henüz veri yok"
          description="Logbook'una ilk antrenmanını işlediğinde ilerlemen burada görünecek."
        />
      </div>
    );
  }

  const selected =
    exercises.find((e) => e.id === ex) ?? exercises[0];

  const chartData: ProgressPoint[] = [...selected.byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, weight]) => ({ label: formatDate(date, "d MMM"), weight }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="İlerleme"
        description="Egzersiz seç, ağırlık gelişimini ve rekorlarını gör."
      />

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {exercises.map((e) => {
          const active = e.id === selected.id;
          return (
            <Link
              key={e.id}
              href={`/ilerleme?ex=${e.id}`}
              scroll={false}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {e.name}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MeasureCard
          icon={Trophy}
          label="Kişisel rekor"
          value={formatNumber(selected.pr)}
          unit="kg"
          hint={selected.name}
        />
        <MeasureCard
          icon={LineChartIcon}
          label="Toplam set"
          value={selected.totalSets}
        />
      </div>

      <PaperCard className="p-4">
        <h2 className="text-label mb-3 text-paper-muted">
          {selected.name} — en iyi set (kg)
        </h2>
        <ProgressChartLazy data={chartData} />
      </PaperCard>

      <PaperCard className="overflow-hidden p-0">
        <p className="text-label border-b border-paper-border p-4 text-paper-muted">
          Geçmiş kayıtlar
        </p>
        <ul className="divide-y divide-paper-border">
          {[...selected.byDate.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, weight]) => (
              <li
                key={date}
                className="flex items-center justify-between p-4 text-sm"
              >
                <span className="text-muted-foreground">{formatDate(date)}</span>
                <span className="font-mono font-medium tabular-nums">
                  {formatNumber(weight)} kg
                </span>
              </li>
            ))}
        </ul>
      </PaperCard>
    </div>
  );
}
