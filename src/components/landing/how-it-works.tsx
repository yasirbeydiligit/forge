"use client";

/**
 * "Nasıl çalışır" — three editorial columns keyed to the semantic research
 * accents (mavi koç yazar · yeşil sporcu işler · amber birlikte izlenir), each
 * with a small SVG vignette that animates once when scrolled into view: the
 * calendar fills, the set rows tick, the sparkline draws toward a PR dot.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cn } from "@/lib/utils";

gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);

const COLUMNS = [
  {
    no: "01",
    accent: "text-lab-blue",
    rule: "bg-lab-blue",
    title: "Koç yazar",
    body: "Program haftalara ve günlere dökülür: set, tekrar, hedef kilo, RIR, dinlenme. Takvime atanır; herkes ne yapacağını bilir.",
  },
  {
    no: "02",
    accent: "text-lab-green",
    rule: "bg-lab-green",
    title: "Sporcu işler",
    body: "Salonda tek elle kayıt: hedef önünde, yaptığın altında. Set biter, defter dolar; PR geldiğinde sayfa bunu bilir.",
  },
  {
    no: "03",
    accent: "text-lab-amber",
    rule: "bg-lab-amber",
    title: "Birlikte izlenir",
    body: "Koça ham veri değil sindirilmiş rapor gider: uyum, set hacmi, kişisel rekorlar. Sorular ortak akışta cevap bulur.",
  },
] as const;

function CalendarVignette() {
  // 7×3 mini month; a training week's cells fill in.
  const cells: { x: number; y: number; on: boolean }[] = [];
  const pattern = [
    false, true, false, true, false, true, false,
    true, false, true, false, true, false, false,
    false, true, false, true, false, true, false,
  ];
  pattern.forEach((on, i) => {
    cells.push({ x: 8 + (i % 7) * 20, y: 10 + Math.floor(i / 7) * 20, on });
  });
  return (
    <svg viewBox="0 0 156 72" aria-hidden className="h-16 w-auto text-lab-blue">
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width="13"
          height="13"
          rx="3"
          className={c.on ? "fill-current" : "fill-none stroke-current opacity-30"}
          strokeWidth="1.5"
          data-cal-cell={c.on ? "" : undefined}
        />
      ))}
    </svg>
  );
}

function LogVignette() {
  // Three set rows: a box, a rule, and a check that draws in.
  return (
    <svg viewBox="0 0 156 72" aria-hidden className="h-16 w-auto text-lab-green">
      {[0, 1, 2].map((row) => {
        const y = 10 + row * 22;
        return (
          <g key={row}>
            <rect
              x="8"
              y={y}
              width="14"
              height="14"
              rx="4"
              className="stroke-current fill-none"
              strokeWidth="1.5"
            />
            <path
              d={`M 11 ${y + 7} l 3 3.5 l 5 -6`}
              className="stroke-current fill-none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              data-log-check
            />
            <path
              d={`M 32 ${y + 7} H 148`}
              className="stroke-current opacity-30"
              strokeWidth="1.5"
              strokeLinecap="round"
              data-log-line
            />
          </g>
        );
      })}
    </svg>
  );
}

function ReportVignette() {
  return (
    <svg viewBox="0 0 156 72" aria-hidden className="h-16 w-auto text-lab-amber">
      <path
        d="M 8 58 L 36 48 L 64 52 L 92 34 L 120 28 L 144 14"
        className="stroke-current fill-none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-spark-line
      />
      <circle cx="144" cy="14" r="4.5" className="fill-current" data-spark-dot />
      <text
        x="144"
        y="34"
        textAnchor="end"
        fontSize="10"
        className="fill-current font-mono"
        data-spark-dot
      >
        PR
      </text>
    </svg>
  );
}

export function HowItWorks() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        root.querySelectorAll("[data-column]").forEach((col) => {
          const tl = gsap.timeline({
            defaults: { ease: "power2.out" },
            scrollTrigger: { trigger: col, start: "top 78%", once: true },
          });
          tl.from(col, { autoAlpha: 0, y: 18, duration: 0.55 })
            .from(
              col.querySelectorAll("[data-cal-cell]"),
              { scale: 0, transformOrigin: "center", duration: 0.3, stagger: 0.05 },
              "-=0.2",
            )
            .from(
              col.querySelectorAll("[data-log-check], [data-log-line]"),
              { drawSVG: "0%", duration: 0.35, stagger: 0.08 },
              "<",
            )
            .from(
              col.querySelectorAll("[data-spark-line]"),
              { drawSVG: "0%", duration: 0.8, ease: "power1.inOut" },
              "<",
            )
            .from(
              col.querySelectorAll("[data-spark-dot]"),
              { scale: 0, transformOrigin: "center", autoAlpha: 0, duration: 0.3 },
              "-=0.15",
            );
        });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="nasil-calisir"
      className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28"
    >
      <p className="text-label text-muted-foreground">İç sayfa</p>
      <h2 id="nasil-calisir" className="text-h1 mt-2 text-lab-ink">
        Nasıl çalışır
      </h2>
      <div className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {COLUMNS.map((col, i) => (
          <article key={col.no} data-column className="min-w-0">
            <div className="flex items-baseline justify-between">
              <span className={cn("font-mono text-sm font-semibold", col.accent)}>
                {col.no}
              </span>
              <span className="text-label text-muted-foreground">
                {i === 0 ? "Program" : i === 1 ? "Logbook" : "Rapor"}
              </span>
            </div>
            <div className={cn("mt-2 h-0.5 w-full", col.rule)} />
            <h3 className="text-h2 mt-4 text-lab-ink">{col.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              {col.body}
            </p>
            <div className="mt-5">
              {i === 0 ? <CalendarVignette /> : i === 1 ? <LogVignette /> : <ReportVignette />}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
