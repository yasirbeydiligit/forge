/**
 * "Hareket geçmişi": the coach picks ANY exercise the athlete has ever logged
 * and reads its full set history — best-set chart on top (same chart the
 * athlete's İlerleme page uses), every set of every session below, newest
 * session first.
 */
import Link from "next/link";
import { History } from "lucide-react";

import { PaperCard } from "@/components/lab/lab";
import { formatDate, formatNumber } from "@/lib/format";

import { ProgressChartLazy, type ProgressPoint } from "@/app/(app)/ilerleme/progress-chart-lazy";

export type ExerciseOption = {
  exerciseId: string;
  name: string;
  totalSets: number;
};

export type HistorySet = {
  date: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
};

export function ExerciseHistoryView({
  options,
  selectedId,
  sets,
  hrefFor,
}: {
  /** Every exercise the athlete ever logged, most-trained first. */
  options: ExerciseOption[];
  selectedId: string | null;
  /** All sets of the selected exercise (any order; view sorts). */
  sets: HistorySet[];
  /** Builds the tab-preserving link that selects an exercise. */
  hrefFor: (exerciseId: string) => string;
}) {
  if (options.length === 0) return null;
  const selected = options.find((o) => o.exerciseId === selectedId) ?? options[0];

  // Group chronologically: date -> sets (by set number).
  const byDate = new Map<string, HistorySet[]>();
  for (const s of sets) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }
  const datesDesc = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  const chartData: ProgressPoint[] = [...byDate.entries()]
    .map(([date, daySets]) => ({
      date,
      weight: Math.max(...daySets.map((s) => (s.weight != null ? Number(s.weight) : 0))),
    }))
    .filter((p) => p.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({ label: formatDate(p.date, "d MMM"), weight: p.weight }));

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <History className="size-4" /> Hareket geçmişi
      </h2>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {options.map((o) => {
          const active = o.exerciseId === selected.exerciseId;
          return (
            <Link
              key={o.exerciseId}
              href={hrefFor(o.exerciseId)}
              scroll={false}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.name}
              <span className="ml-1.5 font-mono text-xs tabular-nums opacity-70">
                {o.totalSets}
              </span>
            </Link>
          );
        })}
      </div>

      {chartData.length >= 2 ? (
        <PaperCard className="p-4">
          <h3 className="text-label mb-3 text-paper-muted">
            {selected.name} — en iyi set (kg)
          </h3>
          <ProgressChartLazy data={chartData} />
        </PaperCard>
      ) : null}

      <PaperCard className="overflow-hidden p-0">
        <p className="text-label border-b border-paper-border p-4 text-paper-muted">
          {selected.name} — tüm setler ({sets.length})
        </p>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper">
              <tr className="border-b border-paper-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Set</th>
                <th className="px-2 py-2 text-center font-medium">Kg</th>
                <th className="px-2 py-2 text-center font-medium">Tekrar</th>
                <th className="px-2 py-2 text-center font-medium">RIR</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {datesDesc.map((date) => {
                const daySets = [...byDate.get(date)!].sort(
                  (a, b) => a.setNumber - b.setNumber,
                );
                return (
                  <SessionRows key={date} date={date} daySets={daySets} />
                );
              })}
            </tbody>
          </table>
        </div>
      </PaperCard>
    </section>
  );
}

function SessionRows({ date, daySets }: { date: string; daySets: HistorySet[] }) {
  return (
    <>
      <tr className="border-b border-border/60 bg-secondary/30">
        <td colSpan={4} className="px-3 py-1.5 text-left">
          <span className="font-serif text-sm not-italic text-foreground">
            {formatDate(date)}
          </span>
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
            {daySets.length} set
          </span>
        </td>
      </tr>
      {daySets.map((s) => (
        <tr
          key={`${date}-${s.setNumber}`}
          className="border-b border-border/40 last:border-0"
        >
          <td className="px-3 py-1.5 text-left text-muted-foreground">
            #{s.setNumber}
          </td>
          <td className="px-2 py-1.5 text-center text-foreground">
            {s.weight != null ? formatNumber(s.weight) : "—"}
          </td>
          <td className="px-2 py-1.5 text-center">{s.reps ?? "—"}</td>
          <td className="px-2 py-1.5 text-center text-muted-foreground">
            {s.rir != null ? formatNumber(s.rir) : "—"}
          </td>
        </tr>
      ))}
    </>
  );
}
