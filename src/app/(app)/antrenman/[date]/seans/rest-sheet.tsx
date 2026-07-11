"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ArrowRight, SkipForward, Trophy } from "lucide-react";

import type { PRType } from "@/lib/pr/evaluate-pr";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** One-line celebration per PR rule; RIR is effort, not load — styled apart. */
const PR_COPY: Record<PRType, string> = {
  weight: "Aynı tekrarda daha fazla kilo. Güçleniyorsun.",
  reps: "Aynı kiloda daha fazla tekrar. Kapasite artıyor.",
  both: "Hem kilo hem tekrar arttı. Büyük gün.",
  tradeoff: "Daha ağır kiloya geçtin. Güç tabanın genişliyor.",
  rir: "Aynı iş, daha az eforla — RIR düştü.",
};

export type RestSheetPr = {
  type: PRType;
  weight: number | null;
  reps: number | null;
};

export type RestSheetNext =
  | { kind: "set"; setNumber: number; weight: number | null; reps: number | null }
  | { kind: "exercise"; name: string }
  | { kind: "summary" };

/**
 * Bottom layer after "Seti tamamla": the screen behind stays visible (dimmed),
 * the countdown is fully manual — closing the sheet never cancels the rest,
 * skipping does. Also hosts the PR moment so the celebration lands exactly
 * where the athlete is looking.
 */
export function RestSheet({
  open,
  restEndsAt,
  totalSeconds,
  pr,
  next,
  onExtend,
  onSkip,
  onClose,
  onAdvance,
  onDone,
}: {
  open: boolean;
  /** null → no rest configured; the sheet is just the PR / next-up moment. */
  restEndsAt: number | null;
  totalSeconds: number;
  pr: RestSheetPr | null;
  next: RestSheetNext;
  onExtend: (seconds: number) => void;
  /** Clear the rest timer and move on. */
  onSkip: () => void;
  /** Dismiss the sheet only; a running timer keeps running (manual logic). */
  onClose: () => void;
  /** Continue to the next exercise / summary (kind !== "set"). */
  onAdvance: () => void;
  onDone: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (restEndsAt == null) return;
    if (Date.now() < restEndsAt) firedRef.current = false;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= restEndsAt && !firedRef.current) {
        firedRef.current = true;
        onDone();
      }
    }, 250);
    return () => clearInterval(id);
  }, [restEndsAt, onDone]);

  // Slide-in entrance for the panel (reduced motion: instant).
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(el, { yPercent: 100, duration: 0.35, ease: "power3.out" });
      });
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, [open]);

  // Escape closes (keeps the timer running).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const remaining = restEndsAt != null ? Math.max(0, restEndsAt - now) : 0;
  const total = Math.max(1, totalSeconds * 1000);
  const pct = restEndsAt != null ? Math.min(1, remaining / total) : 0;
  const done = restEndsAt != null && remaining === 0;
  const isRirPr = pr?.type === "rir";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Dinlenme">
      {/* Dimmed but visible background — context never disappears. */}
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/20"
      />

      <div
        ref={panelRef}
        className={cn(
          "pb-safe relative rounded-t-[22px] border-t border-border bg-card px-5 pt-4 shadow-raised",
          done && "forge-rest-done",
        )}
      >
        <div aria-hidden className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-border" />

        {pr ? (
          <>
            <div className="mb-2 flex justify-center">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs",
                  isRirPr
                    ? "border border-primary bg-transparent text-primary"
                    : "bg-primary text-primary-foreground",
                )}
              >
                <Trophy className="size-3.5" aria-hidden />
                {isRirPr ? "RIR PR" : "PR"}
                {pr.weight != null ? ` — ${formatNumber(pr.weight)} kg` : ""}
                {pr.reps != null ? ` × ${pr.reps}` : ""}
              </span>
            </div>
            <p className="mb-3.5 text-center text-xs text-muted-foreground">
              {PR_COPY[pr.type]}
            </p>
          </>
        ) : null}

        {restEndsAt != null ? (
          <>
            <p
              className={cn(
                "mb-1 text-center font-mono text-[11px] uppercase tracking-[0.16em]",
                done ? "text-lab-green" : "text-muted-foreground",
              )}
            >
              {done ? "Dinlenme bitti" : "Dinlenme"}
            </p>
            <p
              aria-live={done ? "assertive" : "off"}
              className={cn(
                "mb-2.5 text-center font-mono text-[3.25rem] leading-none tabular-nums",
                done ? "text-lab-green" : "text-foreground",
              )}
            >
              {fmt(remaining)}
            </p>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300 ease-linear",
                  done ? "bg-lab-green" : "bg-primary",
                )}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <div className="mb-3.5 flex gap-2">
              <button
                type="button"
                onClick={() => onExtend(30)}
                className="h-12 flex-1 rounded-xl border border-border bg-paper text-sm text-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
              >
                +30 sn
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-paper text-sm text-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
              >
                Atla <SkipForward className="size-4" aria-hidden />
              </button>
            </div>
          </>
        ) : null}

        {next.kind === "set" ? (
          <div className="mb-4 flex items-center justify-between rounded-[10px] bg-surface px-3 py-2.5 text-xs text-muted-foreground">
            <span>Sıradaki</span>
            <span className="font-mono tabular-nums text-foreground">
              SET {next.setNumber}
              {next.reps != null ? ` · hedef ${next.reps}` : ""}
              {next.weight != null ? ` @ ${formatNumber(next.weight)} kg` : ""}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdvance}
            className="mb-4 flex w-full items-center justify-between rounded-[10px] bg-surface px-3 py-3 text-sm transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
          >
            <span className="text-muted-foreground">
              {next.kind === "exercise" ? "Sıradaki egzersiz" : "Antrenman tamamlandı"}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              {next.kind === "exercise" ? next.name : "Özete geç"}
              <ArrowRight className="size-4 text-primary" aria-hidden />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
