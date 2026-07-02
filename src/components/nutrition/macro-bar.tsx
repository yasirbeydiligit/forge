"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCENTS = {
  green: "bg-lab-green",
  amber: "bg-lab-amber",
  violet: "bg-lab-violet",
} as const;

type Accent = keyof typeof ACCENTS;
type Status = "none" | "under" | "on" | "over";

/**
 * Classify progress toward a target into a status plus two bar segments: the
 * accent-coloured part (up to the target) and, when meaningfully over (>110%),
 * an overshoot part. Within 90–110% counts as on-target.
 */
function classify(
  value: number,
  target: number | null,
): { status: Status; pct: number; accentPct: number; overPct: number } {
  if (!target || target <= 0)
    return { status: "none", pct: 0, accentPct: 0, overPct: 0 };
  const ratio = value / target;
  const pct = Math.round(ratio * 100);
  if (ratio > 1.1) {
    return {
      status: "over",
      pct,
      accentPct: (target / value) * 100,
      overPct: ((value - target) / value) * 100,
    };
  }
  return {
    status: ratio >= 0.9 ? "on" : "under",
    pct,
    accentPct: Math.min(ratio, 1) * 100,
    overPct: 0,
  };
}

/** Animate fills in on mount; the global reduced-motion rule flattens it. */
function useGrown() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return grown;
}

function Bar({
  accent,
  accentPct,
  overPct,
  grown,
}: {
  accent: Accent;
  accentPct: number;
  overPct: number;
  grown: boolean;
}) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-paper-foreground/10">
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--dur-slow)] ease-soft",
          ACCENTS[accent],
        )}
        style={{ width: `${grown ? accentPct : 0}%` }}
      />
      {overPct > 0 ? (
        <div
          className="absolute inset-y-0 rounded-full bg-destructive transition-[width,left] duration-[var(--dur-slow)] ease-soft"
          style={{
            left: `${grown ? accentPct : 0}%`,
            width: `${grown ? overPct : 0}%`,
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Signed remaining amount → Turkish label ("122g kaldı", "24g aşıldı",
 * "hedefte"). `unit` is "g" for macros or " kcal" for calories, mirroring the
 * day's kcal "… kaldı / … aşıldı" wording.
 */
function remainingLabel(remaining: number, unit: string): string {
  const n = Math.abs(remaining).toLocaleString("tr-TR");
  if (remaining > 0) return `${n}${unit} kaldı`;
  if (remaining < 0) return `${n}${unit} aşıldı`;
  return "hedefte";
}

/**
 * A macro progress bar that tells the story by filling, not just by number.
 * Colour-coded by status: accent while under/at target, with a destructive
 * overshoot segment when meaningfully over. On-target (90–110%) gets a check.
 * The caption shows how much is left ("122g kaldı") or over ("24g aşıldı").
 */
export function MacroBar({
  label,
  value,
  target,
  accent,
}: {
  label: string;
  value: number;
  target: number | null;
  accent: Accent;
}) {
  const grown = useGrown();
  const { status, pct, accentPct, overPct } = classify(value, target);
  const remaining = (target ?? 0) - value;

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-paper-muted">{label}</span>
        <span className="font-mono tabular-nums text-paper-foreground">
          {value}g
          {target ? <span className="text-paper-muted"> / {target}g</span> : null}
        </span>
      </div>
      <div className="mt-1.5">
        <Bar
          accent={accent}
          accentPct={accentPct}
          overPct={overPct}
          grown={grown}
        />
      </div>
      {status !== "none" ? (
        <p className="mt-1 flex items-center gap-1 font-mono text-[10px] tabular-nums">
          {status === "over" ? (
            <span className="text-destructive">
              %{pct} · {remainingLabel(remaining, "g")}
            </span>
          ) : status === "on" ? (
            <span className="inline-flex items-center gap-0.5 text-lab-green">
              <Check className="size-2.5" /> %{pct} · {remainingLabel(remaining, "g")}
            </span>
          ) : (
            <span className="text-paper-muted">
              %{pct} · {remainingLabel(remaining, "g")}
            </span>
          )}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Total-calorie progress bar for the day. Same status language as MacroBar but
 * keyed to kcal; the page renders the big serif total above it.
 */
export function CalorieBar({
  value,
  target,
}: {
  value: number;
  target: number | null;
}) {
  const grown = useGrown();
  const { status, pct, accentPct, overPct } = classify(value, target);
  const remaining = (target ?? 0) - value;
  if (status === "none") return null;

  return (
    <div>
      <Bar accent="green" accentPct={accentPct} overPct={overPct} grown={grown} />
      <p className="mt-1 font-mono text-[10px] tabular-nums">
        {status === "over" ? (
          <span className="text-destructive">
            %{pct} · {remainingLabel(remaining, " kcal")}
          </span>
        ) : status === "on" ? (
          <span className="text-lab-green">%{pct} · hedefe ulaşıldı</span>
        ) : (
          <span className="text-paper-muted">%{pct}</span>
        )}
      </p>
    </div>
  );
}
