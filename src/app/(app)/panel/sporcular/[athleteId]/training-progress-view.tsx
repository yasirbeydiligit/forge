/**
 * Coach-facing training progress: PRs, first→last top sets, trends and anomaly
 * drops, grouped muscle (category) → region → exercise — the digested view the
 * coach reads instead of raw set logs.
 */
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Dumbbell,
  TrendingDown,
  Trophy,
} from "lucide-react";

import { MeasureCard } from "@/components/measure-card";
import { formatNumber } from "@/lib/format";
import type {
  ExerciseProgress,
  TrainingProgressReport,
  TopSet,
} from "@/lib/reports/training-progress";
import { regionShade } from "@/lib/reports/report-colors";
import { cn } from "@/lib/utils";

function topSetLabel(t: TopSet): string {
  return `${formatNumber(t.weight)}×${t.reps}`;
}

function TrendGlyph({ trend }: { trend: ExerciseProgress["trend"] }) {
  if (trend === "none") return <span className="text-paper-muted">—</span>;
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : ArrowRight;
  return (
    <Icon
      aria-label={trend === "up" ? "yükseliş" : trend === "down" ? "düşüş" : "yatay"}
      className={cn(
        "inline size-3.5",
        trend === "up" && "text-lab-green",
        trend === "down" && "text-lab-rose",
        trend === "flat" && "text-paper-muted",
      )}
    />
  );
}

function ExerciseRow({ ex }: { ex: ExerciseProgress }) {
  const improved =
    ex.lastTop.weight !== ex.firstTop.weight || ex.lastTop.reps !== ex.firstTop.reps;
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-3 py-2 text-left font-sans">
        <span className="text-foreground">{ex.exerciseName}</span>
        {ex.anomaly ? (
          <span
            className="ml-2 inline-flex items-center gap-1 align-middle text-[10px] font-medium text-lab-rose"
            title="Son seansın en iyi seti, dönem rekorunun belirgin altında — gözden geçir"
          >
            <TrendingDown className="size-3" /> ani düşüş
          </span>
        ) : null}
      </td>
      <td className="px-2 py-2 text-center text-muted-foreground">{ex.sessions}</td>
      <td className="px-2 py-2 text-center">
        <span className="text-muted-foreground">{topSetLabel(ex.firstTop)}</span>
        {improved || ex.trend !== "none" ? (
          <>
            <span className="px-1 text-paper-muted">→</span>
            <span className="font-medium text-foreground">
              {topSetLabel(ex.lastTop)}
            </span>
          </>
        ) : null}
      </td>
      <td className="px-2 py-2 text-center">
        {ex.prCount > 0 ? (
          <span className="inline-flex items-center gap-1 font-medium text-lab-green">
            <Trophy className="size-3" /> {ex.prCount}
          </span>
        ) : (
          <span className="text-paper-muted">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <TrendGlyph trend={ex.trend} />
      </td>
    </tr>
  );
}

export function TrainingProgressView({
  report,
}: {
  report: TrainingProgressReport;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        İlerleme raporu · son 12 hafta
      </h2>

      {report.exercisesTotal === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Son 12 haftada kayıtlı antrenman yok.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MeasureCard
              icon={Trophy}
              label="PR"
              value={report.totalPRs}
              accent="green"
              emphasis={report.totalPRs > 0}
              hint={`${report.exercisesWithPR}/${report.exercisesTotal} harekette`}
            />
            <MeasureCard icon={Dumbbell} label="Seans" value={report.sessionCount} />
            <MeasureCard
              label="Hareket"
              value={report.exercisesTotal}
              hint="dönem içinde çalışıldı"
            />
            <MeasureCard
              icon={TrendingDown}
              label="Ani düşüş"
              value={report.anomalyCount}
              accent="rose"
              emphasis={report.anomalyCount > 0}
              hint={report.anomalyCount > 0 ? "gözden geçir" : undefined}
            />
          </div>

          <div className="space-y-3">
            {report.muscles.map((m) => (
              <div
                key={m.muscleSlug}
                className="overflow-hidden rounded-xl border border-border"
              >
                <div className="flex items-baseline justify-between gap-3 border-b border-border bg-secondary/40 px-3 py-2">
                  <h3 className="font-serif text-base font-semibold text-foreground">
                    {m.muscleNameTr}
                  </h3>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {m.regions.reduce(
                      (n, r) => n + r.exercises.reduce((s, e) => s + e.prCount, 0),
                      0,
                    )}{" "}
                    PR
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-medium">Hareket</th>
                      <th className="px-2 py-1.5 text-center font-medium">Seans</th>
                      <th className="px-2 py-1.5 text-center font-medium">
                        Başlangıç → şimdi
                      </th>
                      <th className="px-2 py-1.5 text-center font-medium">PR</th>
                      <th className="px-2 py-1.5 text-center font-medium">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {m.regions.map((r, i) => (
                      <RegionRows
                        key={r.region ?? "-"}
                        muscleSlug={m.muscleSlug}
                        region={r.region}
                        index={i}
                        count={m.regions.length}
                        exercises={r.exercises}
                        showRegion={m.regions.length > 1 || r.region != null}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function RegionRows({
  muscleSlug,
  region,
  index,
  count,
  exercises,
  showRegion,
}: {
  muscleSlug: string;
  region: string | null;
  index: number;
  count: number;
  exercises: ExerciseProgress[];
  showRegion: boolean;
}) {
  return (
    <>
      {showRegion ? (
        <tr className="border-b border-border/60 bg-secondary/20">
          <td colSpan={5} className="px-3 py-1 text-left">
            <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-muted-foreground">
              <span
                className="size-2 rounded-[2px]"
                style={{ background: regionShade(muscleSlug, index, count) }}
                aria-hidden
              />
              {region ?? "Genel"}
            </span>
          </td>
        </tr>
      ) : null}
      {exercises.map((ex) => (
        <ExerciseRow key={ex.exerciseId} ex={ex} />
      ))}
    </>
  );
}
