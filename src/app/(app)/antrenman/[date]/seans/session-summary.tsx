"use client";

import { useState } from "react";
import { ArrowLeft, Check, Loader2, Send, Sparkles } from "lucide-react";

import { InsightNote } from "@/components/library/insight-note";
import { MarginNote } from "@/components/lab/lab";
import { AnimatedNumber } from "@/components/today/animated-number";
import { formatNumber } from "@/lib/format";
import type { SessionReport } from "@/lib/reports/session-report";
import type { AthleteInsight } from "@/lib/rag/insights-server";
import { cn } from "@/lib/utils";

import { shareToFeedAction } from "./actions";
import { fmtDuration, SessionReportView } from "./session-report-view";

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
        <Metric label="Süre" value={<AnimatedDuration ms={durationMs} />} />
        <Metric label="Hacim" value={<AnimatedNumber value={setCount} />} unit="set" />
        <Metric label="Tekrar" value={<AnimatedNumber value={totalReps} />} sub={`${prCount} PR`} />
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
        <SessionReportView report={report!} />
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

/** fmtDuration ("2 sa 5 dk" / "42 dk"), but the figures count up on mount. */
function AnimatedDuration({ ms }: { ms: number }) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return (
    <>
      {h > 0 ? (
        <>
          <AnimatedNumber value={h} />
          <span className="ml-0.5 mr-1 font-mono text-xs text-paper-muted">sa</span>
        </>
      ) : null}
      <AnimatedNumber value={m} />
      <span className="ml-0.5 font-mono text-xs text-paper-muted">dk</span>
    </>
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
  value: React.ReactNode;
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
