import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";

import type { Trend, Valence } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/**
 * Visual mapping for relative-colouring valence. Only `good`/`bad` get a tint
 * and glyph; `neutral`/`none` stay undecorated so the table reads calmly and
 * only real deviations draw the eye.
 *
 * Colour-blind safety: the glyph shape encodes meaning independently of hue —
 * `▲` (chevron up) always means "good for you", `▼` always means "needs
 * attention", regardless of whether the underlying number rose or fell. So a
 * dropping resting-HR still reads as `▲`.
 */

/** Soft cell background tint per valence. */
export const VALENCE_CELL: Record<Valence, string> = {
  good: "bg-lab-green/[0.07]",
  bad: "bg-lab-rose/[0.08]",
  neutral: "",
  none: "",
};

/** Value text colour per valence. */
export const VALENCE_TEXT: Record<Valence, string> = {
  good: "text-lab-green",
  bad: "text-lab-rose",
  neutral: "text-foreground",
  none: "text-foreground",
};

/** The valence glyph (good/bad only). Decorative — the colour + value carry it. */
export function ValenceMark({
  valence,
  className,
}: {
  valence: Valence;
  className?: string;
}) {
  if (valence !== "good" && valence !== "bad") return null;
  const Icon = valence === "good" ? ChevronUp : ChevronDown;
  return (
    <Icon
      aria-hidden
      className={cn(
        "size-3",
        valence === "good" ? "text-lab-green" : "text-lab-rose",
        className,
      )}
    />
  );
}

/**
 * Raw direction glyph for trend-only metrics (e.g. weight): movement without a
 * good/bad judgement, drawn in a neutral tone so it doesn't read as valence.
 */
export function TrendMark({
  trend,
  className,
}: {
  trend: Trend;
  className?: string;
}) {
  if (trend === "none") return null;
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : ArrowRight;
  return <Icon aria-hidden className={cn("size-3 text-paper-muted", className)} />;
}
