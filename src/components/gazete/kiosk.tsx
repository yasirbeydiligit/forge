"use client";

/**
 * The Gazete kiosk (archive): the newest issue as a big front-page cover
 * card, older issues stacked on a chronological shelf below. Milestone
 * issues carry a special-edition badge; unread issues a "YENİ" stamp.
 * Server-rendered markup reads fine without JS; GSAP only lifts things in
 * behind the reduced-motion guard (landing-hero contract).
 */
import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ArrowUpRight } from "lucide-react";

import { Masthead } from "./masthead";
import { PaperCard } from "@/components/lab/lab";
import { formatDate } from "@/lib/format";
import { periodLabel, type Period } from "@/lib/gazete/periods";
import { cn } from "@/lib/utils";

gsap.registerPlugin(SplitText);

export type KioskIssue = {
  id: string;
  periodType: "weekly" | "monthly" | "milestone";
  periodStart: string;
  periodEnd: string;
  milestoneMonths: number | null;
  issueNumber: number;
  headline: string;
  unread: boolean;
};

const TYPE_LABEL = { weekly: "Haftalık", monthly: "Aylık", milestone: "Özel" } as const;

function toPeriod(issue: KioskIssue): Period {
  return issue.periodType === "milestone"
    ? {
        type: "milestone",
        start: issue.periodStart,
        end: issue.periodEnd,
        months: issue.milestoneMonths ?? 0,
      }
    : { type: issue.periodType, start: issue.periodStart, end: issue.periodEnd };
}

function UnreadStamp() {
  return (
    <span className="inline-flex -rotate-3 items-center border-2 border-lab-rose px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lab-rose">
      Yeni
    </span>
  );
}

export function Kiosk({ issues }: { issues: KioskIssue[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [latest, ...rest] = issues;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      let split: SplitText | null = null;
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      const run = () => {
        const headline = root.querySelector("[data-kiosk-headline]");
        if (headline) {
          split = SplitText.create(headline, { type: "lines", mask: "lines" });
          tl.from(split.lines, { yPercent: 110, duration: 0.7, stagger: 0.1 });
        }
        tl.from(
          root.querySelectorAll("[data-kiosk-meta]"),
          { autoAlpha: 0, y: -6, duration: 0.45, stagger: 0.08 },
          "<0.15",
        ).from(
          root.querySelectorAll("[data-kiosk-shelf-item]"),
          { autoAlpha: 0, y: 14, duration: 0.45, stagger: 0.06 },
          "<0.2",
        );
      };
      if (document.fonts?.status === "loaded") run();
      else document.fonts?.ready.then(run);
      return () => {
        tl.kill();
        split?.revert();
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={rootRef} className="mx-auto max-w-3xl">
      <Masthead editionLine={`${formatDate(new Date())} baskısı`} />

      {/* Front page: the latest issue */}
      <Link href={`/gazete/${latest.id}`} className="group mt-6 block">
        <PaperCard className="relative overflow-hidden p-6 transition-shadow group-hover:shadow-lg sm:p-8">
          <div
            data-kiosk-meta
            className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            <span>
              {TYPE_LABEL[latest.periodType]} · Sayı {latest.issueNumber}
            </span>
            <span aria-hidden>—</span>
            <span>{periodLabel(toPeriod(latest))}</span>
            {latest.unread ? <UnreadStamp /> : null}
          </div>
          <h2
            data-kiosk-headline
            className="mt-4 font-serif text-4xl font-medium leading-[1.05] tracking-tight text-lab-ink sm:text-5xl"
          >
            {latest.headline}
          </h2>
          <p
            data-kiosk-meta
            className="mt-5 inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-primary"
          >
            Sayıyı aç
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </p>
        </PaperCard>
      </Link>

      {/* Shelf: older issues */}
      {rest.length > 0 ? (
        <section className="mt-8">
          <p className="mb-2 px-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Arşiv
          </p>
          <div className="divide-y divide-paper-border overflow-hidden rounded-xl border border-paper-border bg-paper paper-shadow">
            {rest.map((issue) => (
              <Link
                key={issue.id}
                href={`/gazete/${issue.id}`}
                data-kiosk-shelf-item
                className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] uppercase tracking-widest",
                    issue.periodType === "milestone"
                      ? "font-bold text-lab-amber"
                      : "text-muted-foreground",
                  )}
                >
                  {issue.periodType === "milestone"
                    ? `${issue.milestoneMonths}. AY ÖZEL`
                    : `${TYPE_LABEL[issue.periodType]} ${issue.issueNumber}`}
                </span>
                <span className="min-w-0 flex-1 truncate font-serif text-base text-lab-ink">
                  {issue.headline}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
                  {periodLabel(toPeriod(issue))}
                </span>
                {issue.unread ? <UnreadStamp /> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
