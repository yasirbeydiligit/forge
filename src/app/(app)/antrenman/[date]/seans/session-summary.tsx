"use client";

import { useState } from "react";
import { ArrowLeft, Check, Loader2, Send, Sparkles } from "lucide-react";

import { InsightNote } from "@/components/library/insight-note";
import { MarginNote } from "@/components/lab/lab";
import type { AthleteInsight } from "@/lib/rag/insights-server";

import { shareToFeedAction } from "./actions";

function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
}

export type SummaryExercise = { name: string; prSets: { weight: number | null; reps: number | null }[] };

export function SessionSummary({
  workoutName,
  durationMs,
  volume,
  setCount,
  prCount,
  prExercises,
  insights,
  initialNote,
  onExit,
  onReopen,
}: {
  workoutName: string;
  durationMs: number;
  volume: number;
  setCount: number;
  prCount: number;
  prExercises: SummaryExercise[];
  insights: AthleteInsight[];
  initialNote: string;
  onExit: (note: string) => void;
  onReopen: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");

  const share = async () => {
    setShareState("sharing");
    const prLine = prCount > 0 ? ` · ${prCount} PR` : "";
    const body = `${workoutName} tamamlandı — ${fmtDuration(durationMs)}, ${volume.toLocaleString("tr-TR")} kg hacim, ${setCount} set${prLine}.`;
    const res = await shareToFeedAction({ body });
    setShareState("error" in res ? "idle" : "done");
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <div className="text-center">
        <p className="text-label text-lab-green">Seans tamamlandı</p>
        <h1 className="text-display mt-1 text-lab-ink">{workoutName}</h1>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-paper-border bg-paper-border">
        <Metric label="Süre" value={fmtDuration(durationMs)} />
        <Metric label="Hacim" value={volume.toLocaleString("tr-TR")} unit="kg" />
        <Metric label="Set" value={String(setCount)} />
      </div>

      {prCount > 0 ? (
        <MarginNote label="Kişisel rekor" accent="green" footer={null}>
          Bu seansta {prCount} sette önceki en iyini geçtin
          {prExercises.length > 0 ? (
            <>
              {" — "}
              <span className="not-italic">
                {prExercises.map((e) => e.name).join(", ")}
              </span>
            </>
          ) : null}
          . Yüklenmeyi kontrollü artırmaya devam et.
        </MarginNote>
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

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-paper px-2 py-4 text-center">
      <p className="font-serif text-2xl leading-none text-paper-foreground">
        {value}
        {unit ? <span className="ml-0.5 font-mono text-xs text-paper-muted">{unit}</span> : null}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-paper-muted">{label}</p>
    </div>
  );
}
