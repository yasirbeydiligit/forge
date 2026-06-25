import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

import { formatRest } from "@/lib/format";
import type { CoachWeeklyReport } from "@/lib/reports/coach-weekly";

type Plateaus = Record<string, { stalled: boolean; sessions: number }>;

/**
 * Coach weekly muscle-based report. Per muscle: which exercises trained it, the
 * order performed, set count, median rest, and RIR. A gentle "dikkat" note marks
 * an exercise that has not progressed in recent sessions. Volume is set count.
 */
export function CoachWeeklyReportView({
  report,
  plateaus,
  weekLabel,
  prevHref,
  nextHref,
}: {
  report: CoachWeeklyReport;
  plateaus: Plateaus;
  weekLabel: string;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Haftalık kas raporu
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            aria-label="Önceki hafta"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-[8.5rem] text-center font-mono text-xs tabular-nums text-foreground">
            {weekLabel}
          </span>
          <Link
            href={nextHref}
            aria-label="Sonraki hafta"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      {report.totalSets === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Bu hafta kayıtlı set yok.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            Toplam {report.totalSets} set · {report.muscles.length} kas grubu
          </p>
          {report.muscles.map((m) => (
            <div key={m.muscleSlug} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-baseline justify-between gap-3 border-b border-border bg-secondary/40 px-3 py-2">
                <h3 className="font-serif text-base font-semibold text-foreground">
                  {m.muscleNameTr}
                </h3>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {m.primarySets} set
                  {m.secondarySets > 0 ? ` · +${m.secondarySets} ikincil` : ""}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-1.5 text-left font-medium">Hareket</th>
                    <th className="px-2 py-1.5 text-center font-medium">Sıra</th>
                    <th className="px-2 py-1.5 text-center font-medium">Set</th>
                    <th className="px-2 py-1.5 text-center font-medium">Dinlenme</th>
                    <th className="px-2 py-1.5 text-center font-medium">RIR</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {m.exercises.map((ex) => {
                    const stalled = plateaus[ex.exerciseId]?.stalled;
                    return (
                      <tr key={ex.exerciseId} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 text-left font-sans">
                          <span className="text-foreground">{ex.exerciseName}</span>
                          {stalled ? (
                            <span
                              className="ml-2 inline-flex items-center gap-1 align-middle text-[10px] font-medium text-lab-amber"
                              title={`Son ${plateaus[ex.exerciseId]!.sessions} seanstır ilerleme yok — gözden geçirilebilir`}
                            >
                              <AlertTriangle className="size-3" /> dikkat
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-center text-muted-foreground">
                          {ex.avgOrder ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-center text-foreground">{ex.sets}</td>
                        <td className="px-2 py-2 text-center text-muted-foreground">
                          {(ex.restMedianSec != null && formatRest(ex.restMedianSec)) || "—"}
                        </td>
                        <td className="px-2 py-2 text-center text-muted-foreground">
                          {ex.avgRir ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
