/**
 * Prominent week navigator for coach report surfaces. Replaces the old tiny
 * chevron pair that was easy to miss: a full-width paper strip with large
 * touch targets, a serif week label and a "bu haftaya dön" shortcut when
 * browsing the past. Server-safe (plain links).
 */
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function WeekSwitcher({
  weekLabel,
  prevHref,
  nextHref,
  currentHref,
  isCurrentWeek,
  className,
}: {
  weekLabel: string;
  prevHref: string;
  nextHref: string;
  /** Target of the "bu haftaya dön" shortcut; hidden on the current week. */
  currentHref?: string;
  isCurrentWeek?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "paper-shadow flex items-center justify-between gap-2 rounded-xl border border-paper-border bg-paper px-2 py-2",
        className,
      )}
    >
      <Link
        href={prevHref}
        aria-label="Önceki hafta"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-paper-border text-paper-muted transition-colors duration-[var(--dur-fast)] ease-soft hover:bg-paper-foreground/[0.04] hover:text-paper-foreground"
      >
        <ChevronLeft className="size-5" />
      </Link>

      <div className="flex min-w-0 flex-col items-center">
        <span className="text-label flex items-center gap-1.5 text-paper-muted">
          <CalendarDays className="size-3" /> Hafta
        </span>
        <span className="truncate font-serif text-base text-paper-foreground">
          {weekLabel}
        </span>
        {currentHref && !isCurrentWeek ? (
          <Link
            href={currentHref}
            className="text-xs font-medium text-lab-green hover:underline"
          >
            Bu haftaya dön
          </Link>
        ) : null}
      </div>

      <Link
        href={nextHref}
        aria-label="Sonraki hafta"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-paper-border text-paper-muted transition-colors duration-[var(--dur-fast)] ease-soft hover:bg-paper-foreground/[0.04] hover:text-paper-foreground"
      >
        <ChevronRight className="size-5" />
      </Link>
    </div>
  );
}
