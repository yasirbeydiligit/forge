"use client";

/**
 * The triage board: athletes needing attention first (worst score on top),
 * everyone healthy folded away below. Cards enter with a soft GSAP stagger —
 * skipped entirely under prefers-reduced-motion.
 */
import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ChevronDown, Sparkles } from "lucide-react";

import { AlertGroups } from "@/components/triage/alert-item";
import { PaperCard } from "@/components/lab/lab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelative, getInitials } from "@/lib/format";
import type { TriageBand, TriageResult } from "@/lib/triage/types";
import { cn } from "@/lib/utils";

import { ScoreRing } from "./score-ring";

const STRIP: Record<TriageBand, string> = {
  green: "bg-lab-green",
  amber: "bg-lab-amber",
  red: "bg-lab-rose",
};

function brief(r: TriageResult): string {
  const parts: string[] = [];
  parts.push(
    r.lastActivity
      ? `son aktivite ${formatRelative(r.lastActivity)}`
      : "hiç aktivite yok",
  );
  if (r.adherenceCount > 0) parts.push(`${r.adherenceCount} uyum`);
  if (r.performanceCount > 0) parts.push(`${r.performanceCount} performans`);
  return parts.join(" · ");
}

export function TriageBoard({ results }: { results: TriageResult[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  const attention = results.filter((r) => r.alerts.length > 0);
  const healthy = results.filter((r) => r.alerts.length === 0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        list.querySelectorAll("[data-triage-card]"),
        { y: 14, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.07,
        },
      );
    }, list);
    return () => ctx.revert();
  }, []);

  return (
    <div className="space-y-3" ref={listRef}>
      {attention.length === 0 ? (
        <PaperCard className="flex items-center gap-3 border-l-2 border-l-lab-green p-4">
          <Sparkles className="size-5 shrink-0 text-lab-green" />
          <div>
            <p className="font-serif text-[15px] italic text-paper-foreground">
              Herkes yolunda — açık uyarı yok.
            </p>
            <p className="text-xs text-paper-muted">
              Görüldü işaretlediklerin, yeni veri gelirse yeniden yüzeye çıkar.
            </p>
          </div>
        </PaperCard>
      ) : (
        attention.map((r) => (
          <PaperCard
            key={r.athleteId}
            data-triage-card
            className="relative overflow-hidden p-4 pl-5"
          >
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 w-1", STRIP[r.band])}
            />
            <div className="flex items-center gap-3">
              <Avatar className="size-11 border border-paper-border">
                {r.avatarUrl ? (
                  <AvatarImage src={r.avatarUrl} alt={r.fullName} />
                ) : null}
                <AvatarFallback className="bg-paper-foreground/[0.06] text-sm font-semibold">
                  {getInitials(r.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/panel/sporcular/${r.athleteId}`}
                  className="truncate font-serif text-lg text-paper-foreground hover:underline"
                >
                  {r.fullName}
                </Link>
                <p className="truncate text-xs text-paper-muted">{brief(r)}</p>
              </div>
              <ScoreRing score={r.score} band={r.band} />
            </div>

            <div className="mt-3 border-t border-paper-border/70 pt-3">
              <AlertGroups
                alerts={r.alerts}
                athleteId={r.athleteId}
                limitPerCategory={2}
              />
            </div>
          </PaperCard>
        ))
      )}

      {healthy.length > 0 ? (
        <details className="group" data-triage-card>
          <summary className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-1 py-2 text-sm font-medium text-paper-muted transition-colors hover:text-paper-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform duration-[var(--dur-base)] ease-soft group-open:rotate-180" />
            Sorunsuz sporcular ({healthy.length})
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {healthy.map((r) => (
              <Link key={r.athleteId} href={`/panel/sporcular/${r.athleteId}`}>
                <PaperCard className="flex items-center gap-3 border-l-2 border-l-lab-green p-3 transition-[transform,box-shadow] duration-[var(--dur-base)] ease-soft hover:-translate-y-0.5 hover:shadow-raised">
                  <Avatar className="size-8 border border-paper-border">
                    {r.avatarUrl ? (
                      <AvatarImage src={r.avatarUrl} alt={r.fullName} />
                    ) : null}
                    <AvatarFallback className="bg-paper-foreground/[0.06] text-xs font-semibold">
                      {getInitials(r.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-paper-foreground">
                      {r.fullName}
                    </p>
                    <p className="truncate text-xs text-paper-muted">
                      {r.lastActivity
                        ? `son aktivite ${formatRelative(r.lastActivity)}`
                        : "hiç aktivite yok"}
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-lab-green">
                    {r.score}
                  </span>
                </PaperCard>
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
