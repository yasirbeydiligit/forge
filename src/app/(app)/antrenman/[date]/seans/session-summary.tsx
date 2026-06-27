"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Loader2,
  Minus,
  Send,
  Sparkles,
  StickyNote,
  Trophy,
} from "lucide-react";

import { InsightNote } from "@/components/library/insight-note";
import { MarginNote } from "@/components/lab/lab";
import { formatNumber } from "@/lib/format";
import { muscleColor, NEUTRAL_SEGMENT, regionShade } from "@/lib/reports/report-colors";
import type { Direction, SessionReport } from "@/lib/reports/session-report";
import type { AthleteInsight } from "@/lib/rag/insights-server";
import { cn } from "@/lib/utils";

import { shareToFeedAction } from "./actions";

function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
}

/** Up/flat/down indicator — icon + Turkish word + colour (never colour-only). */
function DirectionMark({ dir, label }: { dir: Direction | null; label: string }) {
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
 * Server-computed report: segmented-bar muscle/region distribution with
 * approximate time, a PR-by-region highlight, and the movement summary with
 * up/flat/down deltas, typed PR badges (solid green = strength, outline = RIR)
 * and per-set notes.
 */
function ReportSections({ report }: { report: SessionReport }) {
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

export type SummarySet = {
  weight: number | null;
  reps: number | null;
  pr: boolean;
  deltaVsPrev: number | null;
};

export type SummaryExerciseDetail = {
  name: string;
  sets: SummarySet[];
  setCount: number;
  prevSetCount: number | null;
};

/** Lightweight PR list shape kept for the PR margin note. */
export type SummaryExercise = { name: string; prSets: { weight: number | null; reps: number | null }[] };

export function SessionSummary({
  workoutName,
  durationMs,
  setCount,
  totalReps,
  prCount,
  prExercises,
  exercises,
  report,
  reportLoading,
  insights,
  initialNote,
  onExit,
  onReopen,
}: {
  workoutName: string;
  durationMs: number;
  setCount: number;
  totalReps: number;
  prCount: number;
  prExercises: SummaryExercise[];
  exercises: SummaryExerciseDetail[];
  /** Server-computed authoritative report; null/undefined falls back to the client recap. */
  report?: SessionReport | null;
  reportLoading?: boolean;
  insights: AthleteInsight[];
  initialNote: string;
  onExit: (note: string) => void;
  onReopen: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");

  const hasReport = !!report && report.totalSets > 0;

  const share = async () => {
    setShareState("sharing");
    const prLine = prCount > 0 ? ` · ${prCount} PR` : "";
    const body = `${workoutName} tamamlandı — ${fmtDuration(durationMs)}, ${setCount} set hacim${prLine}.`;
    const res = await shareToFeedAction({ body });
    setShareState("error" in res ? "idle" : "done");
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <div className="text-center">
        <p className="text-label text-lab-green">Seans tamamlandı</p>
        <h1 className="text-display mt-1 text-lab-ink">{workoutName}</h1>
      </div>

      {/* Hero metrics — "hacim" is set count in this product, never tonnage. */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-paper-border bg-paper-border">
        <Metric label="Süre" value={fmtDuration(durationMs)} />
        <Metric label="Hacim" value={String(setCount)} unit="set" />
        <Metric label="Tekrar" value={String(totalReps)} sub={`${prCount} PR`} />
      </div>

      {!hasReport && prCount > 0 ? (
        <MarginNote label="Kişisel rekor" accent="green">
          Bu seansta {prCount} sette önceki en iyini geçtin
          {prExercises.length > 0 ? (
            <>
              {" — "}
              <span className="not-italic">{prExercises.map((e) => e.name).join(", ")}</span>
            </>
          ) : null}
          . Yüklenmeyi kontrollü artırmaya devam et.
        </MarginNote>
      ) : null}

      {/* Server-authoritative report; falls back to the client recap offline. */}
      {hasReport ? (
        <ReportSections report={report!} />
      ) : reportLoading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-paper-muted">
          <Loader2 className="size-4 animate-spin" /> Rapor hazırlanıyor…
        </div>
      ) : exercises.length > 0 ? (
        <section className="space-y-2">
          <p className="text-label text-muted-foreground">Egzersizler</p>
          <div className="space-y-px overflow-hidden rounded-2xl border border-paper-border bg-paper-border">
            {exercises.map((ex) => {
              const sDelta = ex.prevSetCount != null ? ex.setCount - ex.prevSetCount : null;
              return (
                <div key={ex.name} className="bg-paper p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-serif text-[15px] font-semibold text-paper-foreground">
                      {ex.name}
                    </p>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-paper-muted">
                      {ex.setCount} set
                      {sDelta != null && sDelta !== 0 ? (
                        <span className={sDelta > 0 ? "text-lab-green" : "text-lab-amber"}>
                          {" "}
                          {sDelta > 0 ? "+" : ""}
                          {sDelta}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ex.sets.map((s, i) => (
                      <span
                        key={i}
                        className={cn(
                          "inline-flex items-baseline gap-1 rounded-md border px-1.5 py-1 font-mono text-xs tabular-nums",
                          s.pr
                            ? "border-lab-green/30 bg-lab-green/10 text-paper-foreground"
                            : "border-paper-border bg-paper-foreground/[0.03] text-paper-foreground",
                        )}
                      >
                        <span className="font-semibold">{formatNumber(s.weight)}</span>
                        <span className="text-paper-muted">×</span>
                        <span className="font-semibold">{s.reps ?? "—"}</span>
                        {s.pr ? (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-lab-green">
                            PR
                          </span>
                        ) : s.deltaVsPrev != null && s.deltaVsPrev !== 0 ? (
                          <span
                            className={cn(
                              "text-[10px]",
                              s.deltaVsPrev > 0 ? "text-lab-green" : "text-lab-amber",
                            )}
                          >
                            {s.deltaVsPrev > 0 ? "+" : ""}
                            {s.deltaVsPrev}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="space-y-2">
        <p className="text-label text-muted-foreground">Seans notu</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Nasıl geçti? His, tempo, ağrı…"
          className="w-full resize-none rounded-xl border border-border bg-paper px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring focus:ring-[3px] focus:ring-ring/40"
        />
      </div>

      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.slice(0, 1).map((insight) => (
            <InsightNote key={insight.key} insight={insight} />
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onExit(note)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-raised transition-transform duration-[var(--dur-fast)] ease-soft active:scale-[0.98]"
        >
          <Check className="size-5" /> Bitir
        </button>

        <button
          type="button"
          onClick={share}
          disabled={shareState !== "idle"}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-paper text-sm font-medium text-foreground transition-colors duration-[var(--dur-fast)] ease-soft hover:bg-muted disabled:opacity-60"
        >
          {shareState === "sharing" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : shareState === "done" ? (
            <Sparkles className="size-4 text-lab-green" />
          ) : (
            <Send className="size-4" />
          )}
          {shareState === "done" ? "Feed'de paylaşıldı" : "Feed'de paylaş"}
        </button>

        <button
          type="button"
          onClick={onReopen}
          className="flex h-10 w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Seansa geri dön
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  sub,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  delta?: number | null;
}) {
  return (
    <div className="bg-paper px-2 py-4 text-center">
      <p className="font-serif text-2xl leading-none text-paper-foreground">
        {value}
        {unit ? <span className="ml-0.5 font-mono text-xs text-paper-muted">{unit}</span> : null}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-paper-muted">{label}</p>
      {delta != null && delta !== 0 ? (
        <p
          className={cn(
            "mt-0.5 font-mono text-[10px] tabular-nums",
            delta > 0 ? "text-lab-green" : "text-lab-amber",
          )}
        >
          {delta > 0 ? "+" : ""}
          {Math.round(delta).toLocaleString("tr-TR")} vs geçen
        </p>
      ) : sub ? (
        <p className="mt-0.5 font-mono text-[10px] tabular-nums text-paper-muted">{sub}</p>
      ) : null}
    </div>
  );
}
