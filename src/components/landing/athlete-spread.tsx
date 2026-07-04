"use client";

/**
 * "Forma I — Sporcu": the whole-day grid. Six specimen cards in the app's real
 * grammar — beslenme macro bars filling, hydration glasses, a step sparkline,
 * a cardio entry, the günlük takip row and a fizik comparison — animating in
 * once on scroll. The message: Forge covers the day, not just the gym.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cn } from "@/lib/utils";

gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);

const MACROS = [
  { label: "Protein", value: "156 / 180 g", pct: 87, bar: "bg-lab-green" },
  { label: "Karbonhidrat", value: "204 / 250 g", pct: 82, bar: "bg-lab-amber" },
  { label: "Yağ", value: "58 / 70 g", pct: 83, bar: "bg-lab-violet" },
];

const TRACKER = [
  { label: "Kilo", value: "82,4" },
  { label: "Uyku", value: "7,5" },
  { label: "RHR", value: "58" },
  { label: "Enerji", value: "8" },
  { label: "Adım", value: "9.480" },
];

function CardShell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-day-card
      className={cn(
        "rounded-xl border border-paper-border bg-paper p-5 text-paper-foreground paper-shadow",
        className,
      )}
    >
      <p className="text-label text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function AthleteSpread() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: "power2.out" },
          scrollTrigger: { trigger: root, start: "top 72%", once: true },
        });
        tl.from("[data-day-card]", {
          autoAlpha: 0,
          y: 18,
          duration: 0.5,
          stagger: 0.08,
        })
          .from(
            "[data-macro-fill]",
            {
              scaleX: 0,
              transformOrigin: "left center",
              duration: 0.7,
              stagger: 0.1,
            },
            "-=0.3",
          )
          .from(
            "[data-glass]",
            { scaleY: 0, transformOrigin: "bottom", duration: 0.25, stagger: 0.05 },
            "<",
          )
          .from(
            "[data-step-line]",
            { drawSVG: "0%", duration: 0.8, ease: "power1.inOut" },
            "<",
          )
          .from(
            "[data-tracker-cell]",
            { autoAlpha: 0, y: 6, duration: 0.3, stagger: 0.05 },
            "-=0.4",
          );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="sporcu-formasi"
      className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28"
    >
      <p className="text-label text-muted-foreground">Forma I — Sporcu</p>
      <h2 id="sporcu-formasi" className="text-h1 mt-2 text-lab-ink">
        Günün tamamı, tek defter
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Salon sayfası sadece başlangıç. Öğünler ve makrolar, su, adım, kardiyo,
        uyku, kilo, fizik fotoğrafları — hepsi aynı deftere işlenir. Sen
        yaşarsın; defter toplar.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Beslenme: kcal + the app's three macro bars. */}
        <CardShell label="Beslenme">
          <p className="mt-2 font-mono text-lg tabular-nums text-lab-ink">
            1.840 <span className="text-sm text-muted-foreground">/ 2.400 kcal</span>
          </p>
          <div className="mt-3 space-y-2.5">
            {MACROS.map((m) => (
              <div key={m.label}>
                <div className="flex items-baseline justify-between">
                  <span className="text-caption text-muted-foreground">
                    {m.label}
                  </span>
                  <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                    {m.value}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div
                    data-macro-fill
                    className={cn("h-full rounded-full", m.bar)}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardShell>

        {/* Hidrasyon: 12 glasses, 10 filled — 250 ml each, exactly the app. */}
        <CardShell label="Hidrasyon">
          <p className="mt-2 font-mono text-lg tabular-nums text-lab-ink">
            2,5 <span className="text-sm text-muted-foreground">/ 3 L</span>
          </p>
          <div className="mt-4 flex items-end gap-1.5">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                data-glass={i < 10 ? "" : undefined}
                className={cn(
                  "h-7 flex-1 rounded-sm",
                  i < 10 ? "bg-lab-blue/70" : "border border-paper-border bg-surface",
                )}
              />
            ))}
          </div>
          <p className="text-caption mt-3 text-muted-foreground">
            10 / 12 bardak · 1 bardak = 250 ml
          </p>
        </CardShell>

        {/* Adım: count + sparkline, like the Bugün summary box. */}
        <CardShell label="Adım">
          <p className="mt-2 font-mono text-lg tabular-nums text-lab-ink">9.480</p>
          <svg viewBox="0 0 140 36" aria-hidden className="mt-3 w-full text-lab-green">
            <path
              data-step-line
              d="M 2 30 L 22 26 L 42 28 L 62 18 L 82 22 L 102 10 L 122 14 L 138 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-caption mt-2 text-muted-foreground">son 7 gün</p>
        </CardShell>

        {/* Kardiyo: entry in the app's own "{dk} dk · {km} km · {kcal} kcal" format. */}
        <CardShell label="Kardiyo">
          <p className="mt-2 font-serif text-lg text-lab-ink">Yürüyüş</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
            32 dk · 2,4 km · 176 kcal
          </p>
          <p className="text-caption mt-3 text-muted-foreground">
            Yürüyüş, koşu, yüzme… kısa bir kayıt bile sayılır.
          </p>
        </CardShell>

        {/* Günlük takip: the weekly table's columns, one day's row. */}
        <CardShell label="Günlük takip">
          <div className="mt-3 grid grid-cols-5 gap-2">
            {TRACKER.map((cell) => (
              <div key={cell.label} data-tracker-cell className="min-w-0">
                <p className="text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  {cell.label}
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums text-lab-ink">
                  {cell.value}
                </p>
              </div>
            ))}
          </div>
          <p className="text-caption mt-3 text-muted-foreground">
            Hücreler kendi ortalamana göre renklenir.
          </p>
        </CardShell>

        {/* Fizik: the compare view's Δ line. */}
        <CardShell label="Fizik">
          <div className="mt-3 flex items-center gap-3">
            {(["Önce", "Sonra"] as const).map((tag) => (
              <div
                key={tag}
                className="flex h-16 flex-1 items-end justify-start rounded-lg border border-paper-border bg-surface p-2"
              >
                <span className="text-label text-muted-foreground">{tag}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-sm tabular-nums text-lab-green">
            Δ 42 gün · −3,4 kg
          </p>
          <p className="text-caption mt-1 text-muted-foreground">
            Aynı ışık, aynı poz — değişimi zaman konuşsun.
          </p>
        </CardShell>
      </div>
    </section>
  );
}
