import { ArrowDown, ArrowUp, Minus, StickyNote, Trophy } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { muscleColor, NEUTRAL_SEGMENT, regionShade } from "@/lib/reports/report-colors";
import type { Direction, SessionReport } from "@/lib/reports/session-report";
import { cn } from "@/lib/utils";

/** Presentational, no hooks — safe in both the (client) athlete summary and the
 * (server) coach session view. */

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
}

/** Up/flat/down indicator — icon + Turkish word + colour (never colour-only). */
export function DirectionMark({ dir, label }: { dir: Direction | null; label: string }) {
  if (dir == null) return null;
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
  const tone =
    dir === "up" ? "text-lab-green" : dir === "down" ? "text-lab-amber" : "text-paper-muted";
  const word = dir === "up" ? "arttı" : dir === "down" ? "azaldı" : "sabit";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", tone)}>
      <Icon className="size-3" aria-hidden />
      {label} {word}
    </span>
  );
}

/** One muscle's volume as a segmented bar (length ∝ sets, segments = regions). */
function MuscleBar({
  muscle,
  maxPrimary,
}: {
  muscle: SessionReport["muscles"][number];
  maxPrimary: number;
}) {
  const { muscleSlug, muscleNameTr, primarySets, secondarySets, regions, activeMs } = muscle;
  const regionSum = regions.reduce((a, r) => a + r.primarySets, 0);
  const remainder = primarySets - regionSum;
  // Secondary-only muscles still get a (faded) bar so they're not blank.
  const fillValue = primarySets > 0 ? primarySets : secondarySets;
  const fillPct = maxPrimary > 0 ? (fillValue / maxPrimary) * 100 : 0;

  return (
    <div className="bg-paper p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-[15px] font-semibold text-paper-foreground">
          {muscleNameTr}
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums">
          {primarySets > 0 ? (
            <span className="font-semibold text-lab-green">{primarySets} set</span>
          ) : null}
          {secondarySets > 0 ? (
            <span className="text-paper-muted">
              {primarySets > 0 ? " " : ""}+{secondarySets} ikincil
            </span>
          ) : null}
          {activeMs > 0 ? <span className="text-paper-muted"> · ~{fmtDuration(activeMs)}</span> : null}
        </span>
      </div>

      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-paper-foreground/[0.06] ring-1 ring-inset ring-paper-foreground/[0.04]">
        <div className="flex h-full gap-px" style={{ width: `${Math.max(fillPct, 4)}%` }}>
          {primarySets > 0 ? (
            <>
              {regions.map((r, i) => (
                <div
                  key={r.region}
                  style={{
                    width: `${(r.primarySets / primarySets) * 100}%`,
                    background: regionShade(muscleSlug, i, regions.length),
                  }}
                />
              ))}
              {regions.length === 0 ? (
                <div style={{ width: "100%", background: muscleColor(muscleSlug) }} />
              ) : null}
              {remainder > 0 ? (
                <div
                  style={{ width: `${(remainder / primarySets) * 100}%`, background: NEUTRAL_SEGMENT }}
                />
              ) : null}
            </>
          ) : (
            <div style={{ width: "100%", background: NEUTRAL_SEGMENT }} />
          )}
        </div>
      </div>

      {regions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {regions.map((r, i) => (
            <span key={r.region} className="inline-flex items-center gap-1.5 text-paper-muted">
              <span
                className="size-2 rounded-[2px]"
                style={{ background: regionShade(muscleSlug, i, regions.length) }}
                aria-hidden
              />
              {r.region}
              <span className="font-mono tabular-nums font-medium text-paper-foreground">
                {r.primarySets}
              </span>
            </span>
          ))}
          {remainder > 0 ? <span className="text-paper-muted">Diğer {remainder}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The full session report body: segmented-bar muscle/region distribution with
 * approximate time, a PR-by-region highlight, and the movement summary with
 * up/flat/down deltas, typed PR badges (solid green = strength, outline = RIR)
 * and per-set notes. Shared by the athlete finish summary and the coach view.
 */
export function SessionReportView({ report }: { report: SessionReport }) {
  const muscles = report.muscles.filter((m) => m.primarySets > 0 || m.secondarySets > 0);
  const maxPrimary = Math.max(1, ...muscles.map((m) => m.primarySets || m.secondarySets));

  return (
    <>
      {muscles.length > 0 ? (
        <section className="space-y-2">
          <p className="text-label text-muted-foreground">Kas dağılımı</p>
          <div className="space-y-px overflow-hidden rounded-2xl border border-paper-border bg-paper-border">
            {muscles.map((m) => (
              <MuscleBar key={m.muscleSlug} muscle={m} maxPrimary={maxPrimary} />
            ))}
          </div>
        </section>
      ) : null}

      {report.prCount > 0 || report.rirPrCount > 0 ? (
        <section className="space-y-2">
          <p className="text-label text-muted-foreground">Kişisel rekorlar</p>
          <div className="overflow-hidden rounded-2xl border border-lab-green/30 bg-lab-green/[0.06]">
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lab-green/15">
                <Trophy className="size-5 text-lab-green" aria-hidden />
              </div>
              <div className="min-w-0">
                {report.prCount > 0 ? (
                  <p className="font-serif text-xl leading-none text-paper-foreground">
                    {report.prCount}
                    <span className="ml-1.5 text-sm text-paper-muted">güç rekoru</span>
                  </p>
                ) : (
                  <p className="font-serif text-xl leading-none text-paper-foreground">
                    {report.rirPrCount}
                    <span className="ml-1.5 text-sm text-paper-muted">RIR rekoru</span>
                  </p>
                )}
                {report.prGroups.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {report.prGroups.map((g) => (
                      <span
                        key={g.label}
                        className="inline-flex items-center gap-1 rounded-full border border-lab-green/30 bg-paper px-2.5 py-0.5 text-xs text-paper-foreground"
                      >
                        {g.label}
                        {g.count > 1 ? (
                          <span className="font-mono tabular-nums text-lab-green">×{g.count}</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            {report.prCount > 0 && report.rirPrCount > 0 ? (
              <p className="flex items-center gap-2 border-t border-lab-green/20 px-4 py-2.5 text-xs text-lab-blue">
                <span className="rounded-full border border-lab-blue/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  RIR
                </span>
                Ayrıca {report.rirPrCount} sette daha az yedekle aynı işi yaptın.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {report.exercises.length > 0 ? (
        <section className="space-y-2">
          <p className="text-label text-muted-foreground">Hareket özeti</p>
          <div className="space-y-px overflow-hidden rounded-2xl border border-paper-border bg-paper-border">
            {report.exercises.map((ex) => (
              <div key={ex.exerciseId} className="bg-paper p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <p className="truncate font-serif text-[15px] font-semibold text-paper-foreground">
                      {ex.exerciseName}
                    </p>
                    {ex.region ? (
                      <span className="shrink-0 rounded-full bg-paper-foreground/[0.05] px-2 py-0.5 text-[10px] text-paper-muted">
                        {ex.region}
                      </span>
                    ) : null}
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    <DirectionMark dir={ex.weight} label="kg" />
                    <DirectionMark dir={ex.reps} label="tekrar" />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ex.sets.map((s, i) => {
                    const strengthPr = s.prType != null && s.prType !== "rir";
                    const rirPr = s.prType === "rir";
                    return (
                      <span
                        key={i}
                        className={cn(
                          "inline-flex items-baseline gap-1 rounded-md border px-1.5 py-1 font-mono text-xs tabular-nums",
                          strengthPr
                            ? "border-lab-green/30 bg-lab-green/10 text-paper-foreground"
                            : "border-paper-border bg-paper-foreground/[0.03] text-paper-foreground",
                        )}
                      >
                        <span className="font-semibold">{formatNumber(s.weight)}</span>
                        <span className="text-paper-muted">×</span>
                        <span className="font-semibold">{s.reps ?? "—"}</span>
                        {strengthPr ? (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-lab-green">
                            PR
                          </span>
                        ) : rirPr ? (
                          <span className="rounded-sm border border-lab-green/50 px-1 text-[9px] font-semibold uppercase tracking-wider text-lab-green">
                            RIR
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
                {ex.sets.some((s) => s.note) ? (
                  <ul className="mt-2 space-y-1 border-t border-paper-border pt-2">
                    {ex.sets.map((s, i) =>
                      s.note ? (
                        <li key={i} className="flex gap-1.5 text-[11px] text-paper-muted">
                          <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden />
                          <span>{s.note}</span>
                        </li>
                      ) : null,
                    )}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
