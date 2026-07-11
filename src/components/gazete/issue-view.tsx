"use client";

/**
 * A printed Gazete issue — the front page itself. Anatomy (single column on
 * mobile, the stories fan out to two columns from md):
 * masthead band → serif manşet (SplitText mask) → lead (counting stat +
 * self-drawing sparkline) → story cards (ScrollReveal + scaleX fill bars) →
 * "Rakamlarla Bu Dönem" mono table → photo curtain (if any) → Editörün Notu →
 * closing line with the next-milestone countdown.
 *
 * All motion sits behind gsap.matchMedia's reduced-motion guard and the
 * markup is server-rendered readable without JS (landing-hero contract).
 */
import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { ArrowLeft } from "lucide-react";

import { Masthead } from "./masthead";
import { PhotoCompare } from "./photo-compare";
import { SparkLine } from "./spark-line";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { PaperCard } from "@/components/lab/lab";
import { differenceInCalendarDays } from "date-fns";
import type { IssuePayload } from "@/lib/gazete/build-issue";
import { formatNumber, parseDateKey } from "@/lib/format";
import { periodLabel, type Period } from "@/lib/gazete/periods";
import { cn } from "@/lib/utils";

gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger, SplitText);

export type IssueMeta = {
  periodType: "weekly" | "monthly" | "milestone";
  periodStart: string;
  periodEnd: string;
  milestoneMonths: number | null;
  issueNumber: number;
};

const TYPE_LABEL = { weekly: "Haftalık", monthly: "Aylık", milestone: "Özel" } as const;

function toPeriod(meta: IssueMeta): Period {
  return meta.periodType === "milestone"
    ? {
        type: "milestone",
        start: meta.periodStart,
        end: meta.periodEnd,
        months: meta.milestoneMonths ?? 0,
      }
    : { type: meta.periodType, start: meta.periodStart, end: meta.periodEnd };
}

const DELTA_GLYPH = { up: "▲", down: "▾", flat: "–" } as const;

export function IssueView({
  issue,
  payload,
  photoUrls,
  athleteName,
  backHref,
}: {
  issue: IssueMeta;
  payload: IssuePayload;
  photoUrls: { before: string; after: string } | null;
  athleteName: string;
  backHref?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      let split: SplitText | null = null;
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      const run = () => {
        const headline = root.querySelector("[data-issue-headline]");
        if (headline) {
          split = SplitText.create(headline, { type: "lines", mask: "lines" });
          tl.from(split.lines, { yPercent: 110, duration: 0.8, stagger: 0.12 });
        }
        tl.from(
          root.querySelectorAll("[data-issue-meta]"),
          { autoAlpha: 0, y: -6, duration: 0.5, stagger: 0.1 },
          "<0.2",
        );

        // Lead: counting number + self-drawing spark.
        const counter = root.querySelector<HTMLElement>("[data-issue-count]");
        if (counter) {
          const target = Number(counter.dataset.issueCount);
          const decimals = target % 1 !== 0 ? 1 : 0;
          const proxy = { n: 0 };
          tl.to(
            proxy,
            {
              n: target,
              duration: 1.3,
              ease: "power2.out",
              onUpdate: () => {
                counter.textContent =
                  decimals > 0
                    ? proxy.n.toFixed(decimals).replace(".", ",")
                    : formatNumber(Math.round(proxy.n));
              },
            },
            "<0.1",
          );
        }
        const spark = root.querySelector("[data-issue-spark]");
        if (spark) {
          tl.from(spark, { drawSVG: "0%", duration: 1.1, ease: "power2.inOut" }, "<0.2");
        }

        // Story fill bars scale in as they scroll into view (ScrollReveal
        // handles the card entrances; the bars are the accent beat).
        root.querySelectorAll<HTMLElement>("[data-issue-fill]").forEach((bar) => {
          gsap.from(bar, {
            scaleX: 0,
            transformOrigin: "left center",
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: bar, start: "top 85%", once: true },
          });
        });
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

  const daysToMilestone =
    payload.closing.nextMilestoneDate != null
      ? differenceInCalendarDays(
          parseDateKey(payload.closing.nextMilestoneDate),
          new Date(),
        )
      : null;

  return (
    <article ref={rootRef} className="mx-auto max-w-3xl">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Arşiv
        </Link>
      ) : null}

      <Masthead
        issueLine={`${TYPE_LABEL[issue.periodType]} Sayı ${issue.issueNumber} · ${periodLabel(toPeriod(issue))}`}
        editionLine={`${athleteName} adına özel baskı`}
      />

      {/* Manşet */}
      <h1
        data-issue-headline
        className="mt-8 text-balance font-serif text-5xl font-medium leading-[1.02] tracking-tight text-lab-ink sm:text-6xl md:text-7xl"
      >
        {payload.headline.title}
      </h1>

      {/* Lead */}
      <div className="mt-6 grid gap-6 border-y border-lab-ink/15 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div data-issue-meta>
          {payload.lead.stat ? (
            <p className="flex items-baseline gap-2">
              <span className="font-serif text-6xl font-medium tracking-tight text-lab-ink sm:text-7xl">
                <span
                  data-issue-count={payload.lead.stat.value}
                  suppressHydrationWarning
                >
                  {formatNumber(payload.lead.stat.value)}
                </span>
                {payload.lead.stat.suffix}
              </span>
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {payload.lead.stat.label}
              </span>
            </p>
          ) : null}
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-foreground/90">
            {payload.lead.body}
          </p>
        </div>
        {payload.lead.spark ? (
          <div data-issue-meta className="text-primary">
            <SparkLine points={payload.lead.spark} className="h-14 w-full sm:w-60" />
            <p className="mt-1 text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              set / {issue.periodType === "weekly" ? "gün" : issue.periodType === "monthly" ? "hafta" : "ay"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Hikâyeler */}
      {payload.stories.length > 0 ? (
        <ScrollReveal className="mt-8 grid gap-4 md:grid-cols-2">
          {payload.stories.map((story) => (
            <PaperCard key={story.factType} className="flex flex-col gap-2 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-serif text-xl font-medium leading-snug text-lab-ink">
                  {story.title}
                </h3>
                {story.stat ? (
                  <p className="shrink-0 text-right">
                    <span className="block font-serif text-lg font-medium text-lab-ink">
                      {story.stat.value}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {story.stat.label}
                    </span>
                  </p>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-foreground/85">{story.body}</p>
              {story.fill != null ? (
                <div className="mt-auto pt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      data-issue-fill
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(story.fill * 100)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </PaperCard>
          ))}
        </ScrollReveal>
      ) : null}

      {/* Rakamlarla Bu Dönem */}
      {payload.statTable.length > 0 ? (
        <ScrollReveal className="mt-10">
          <h2 className="border-b-2 border-lab-ink/80 pb-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-lab-ink">
            Rakamlarla Bu Dönem
          </h2>
          <dl className="divide-y divide-paper-border font-mono text-sm">
            {payload.statTable.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="flex items-baseline gap-2 text-lab-ink">
                  {row.value}
                  {row.delta ? (
                    <span
                      aria-label={
                        row.delta === "up" ? "önceki döneme göre arttı" : row.delta === "down" ? "önceki döneme göre azaldı" : "değişmedi"
                      }
                      className={cn(
                        "text-xs",
                        row.delta === "up" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {DELTA_GLYPH[row.delta]}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </ScrollReveal>
      ) : null}

      {/* Fizik karşılaştırma */}
      {payload.photos && photoUrls ? (
        <section className="mt-10">
          <h2 className="mb-3 border-b-2 border-lab-ink/80 pb-1 font-mono text-xs font-bold uppercase tracking-[0.15em] text-lab-ink">
            Gözle Görülür Fark
          </h2>
          <PhotoCompare photos={payload.photos} urls={photoUrls} />
        </section>
      ) : null}

      {/* Editörün Notu */}
      {payload.editorNotes.length > 0 ? (
        <ScrollReveal className="mt-10">
          <aside className="rounded-lg border border-lab-amber/50 bg-lab-amber/5 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-lab-amber">
              Editörün Notu
            </p>
            <ul className="mt-2 space-y-1.5">
              {payload.editorNotes.map((note) => (
                <li key={note} className="text-sm leading-relaxed text-foreground/85">
                  {note}
                </li>
              ))}
            </ul>
          </aside>
        </ScrollReveal>
      ) : null}

      {/* Kapanış */}
      <footer className="mt-12 border-t-2 border-lab-ink/80 pb-4 pt-4 text-center">
        <p className="font-serif text-lg text-lab-ink">{payload.closing.line}</p>
        {payload.closing.nextMilestoneMonths != null && daysToMilestone != null && daysToMilestone > 0 ? (
          // suppressHydrationWarning: the day count is computed from "now" and
          // can differ across a midnight server/client boundary.
          <p
            suppressHydrationWarning
            className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            {payload.closing.nextMilestoneMonths}. Ay Özel Sayısı&apos;na {daysToMilestone} gün
          </p>
        ) : null}
      </footer>
    </article>
  );
}
