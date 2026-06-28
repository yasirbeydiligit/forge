import type { LucideIcon } from "lucide-react";

import { PaperCard } from "@/components/lab/lab";
import { Sparkline } from "@/components/logbook/sparkline";
import { cn } from "@/lib/utils";

/**
 * The single "measurement card" used everywhere a metric is surfaced — PR /
 * total-set tiles (İlerleme), weekly averages (Takip), and the coach panel
 * stats. One shape: a tracked mono label up top, a big serif hero value with an
 * optional mono unit, and optional icon / sparkline / hint. Replaces the old
 * `StatCard` and the per-page `AverageCard`.
 *
 * Typography follows the house rule: serif for the hero figure, mono for the
 * unit and the tracked label.
 */
const ACCENTS = {
  green: { fg: "text-lab-green", spark: "var(--lab-green)", ring: "ring-lab-green/30 bg-lab-green/[0.05]" },
  amber: { fg: "text-lab-amber", spark: "var(--lab-amber)", ring: "ring-lab-amber/40 bg-lab-amber/[0.06]" },
  rose: { fg: "text-lab-rose", spark: "var(--lab-rose)", ring: "ring-lab-rose/40 bg-lab-rose/[0.06]" },
  blue: { fg: "text-lab-blue", spark: "var(--lab-blue)", ring: "ring-lab-blue/30 bg-lab-blue/[0.05]" },
  violet: { fg: "text-lab-violet", spark: "var(--lab-violet)", ring: "ring-lab-violet/30 bg-lab-violet/[0.05]" },
} as const;

export function MeasureCard({
  label,
  value,
  unit,
  icon: Icon,
  points,
  hint,
  accent = "green",
  emphasis = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  /** Optional inline sparkline series (>= 2 points to render a line). */
  points?: number[];
  hint?: string;
  accent?: keyof typeof ACCENTS;
  /** Draw the eye: colours the value + adds a soft accent ring (e.g. a coach's
   * pending-question count > 0). */
  emphasis?: boolean;
  className?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <PaperCard
      className={cn("flex flex-col p-4", emphasis && cn("ring-1", a.ring), className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label text-paper-muted">{label}</span>
        {Icon ? <Icon className={cn("size-4 shrink-0", a.fg)} /> : null}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            "font-serif text-3xl leading-none tabular-nums",
            emphasis ? a.fg : "text-paper-foreground",
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-sm text-paper-muted">{unit}</span>
        ) : null}
      </div>

      {hint ? <p className="mt-1 text-xs text-paper-muted">{hint}</p> : null}

      {points ? (
        <div className="mt-3">
          <Sparkline points={points} width={120} height={24} color={a.spark} />
        </div>
      ) : null}
    </PaperCard>
  );
}
