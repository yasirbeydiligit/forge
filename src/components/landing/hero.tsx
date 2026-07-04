"use client";

/**
 * Landing hero: the magazine cover. A masthead nameplate ("FORGE"), the issue
 * line, a serif manşet revealed line by line (SplitText mask), and a barbell
 * figure that draws itself in (DrawSVG) with mono figure annotations — Şekil 1
 * of the training journal. All motion sits behind a reduced-motion guard; the
 * markup is server-rendered and fully readable without JS.
 */
import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { SplitText } from "gsap/SplitText";

import { Button } from "@/components/ui/button";

gsap.registerPlugin(DrawSVGPlugin, SplitText);

export function LandingHero() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      let splits: SplitText[] = [];
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      // Wait for webfonts so SplitText measures real line boxes.
      const run = () => {
        const nameplate = root.querySelector("[data-hero-nameplate]");
        const headline = root.querySelector("[data-hero-headline]");
        if (!nameplate || !headline) return;

        const name = SplitText.create(nameplate, {
          type: "chars",
          mask: "chars",
        });
        const lines = SplitText.create(headline, {
          type: "lines",
          mask: "lines",
        });
        splits = [name, lines];

        tl.from(name.chars, {
          yPercent: 110,
          duration: 0.7,
          stagger: 0.045,
        })
          .from(
            "[data-hero-meta]",
            { autoAlpha: 0, y: -6, duration: 0.5, stagger: 0.1 },
            "<0.2",
          )
          .from(
            lines.lines,
            { yPercent: 110, duration: 0.8, stagger: 0.12 },
            "-=0.25",
          )
          .from(
            "[data-hero-deck]",
            { autoAlpha: 0, y: 10, duration: 0.55, stagger: 0.08 },
            "-=0.35",
          )
          .from(
            "[data-hero-figure] [data-draw]",
            {
              drawSVG: "0%",
              duration: 1.1,
              stagger: 0.08,
              ease: "power1.inOut",
            },
            "-=0.3",
          )
          .from(
            "[data-hero-figure] [data-annotation]",
            { autoAlpha: 0, y: 4, duration: 0.4, stagger: 0.12 },
            "-=0.3",
          );
      };

      const ctx = gsap.context(() => {
        if (document.fonts.status === "loaded") run();
        else document.fonts.ready.then(() => ctx.add(run));
      }, root);

      return () => {
        ctx.revert();
        splits.forEach((s) => s.revert());
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6"
    >
      {/* Masthead: issue metadata over the nameplate, hairlines like a printed cover. */}
      <div
        data-hero-meta
        className="text-label flex items-baseline justify-between border-b border-border pb-3 text-muted-foreground"
      >
        <span>Sayı 01 — Temmuz 2026</span>
        <span className="hidden sm:inline">Antrenman defteri</span>
        <span>Kapalı topluluk</span>
      </div>

      <h1
        data-hero-nameplate
        className="mt-6 text-center font-serif font-semibold tracking-[-0.03em] text-lab-ink"
        style={{ fontSize: "clamp(4.5rem, 16vw, 11rem)", lineHeight: 0.95 }}
      >
        FORGE
      </h1>

      <div data-hero-meta className="mt-5 border-y-2 border-lab-ink py-1.5">
        <div className="text-label flex items-center justify-center gap-3 text-muted-foreground">
          <span>Koç yazar</span>
          <span aria-hidden>·</span>
          <span>Sporcu işler</span>
          <span aria-hidden>·</span>
          <span>Defter konuşur</span>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-2xl text-center sm:mt-16">
        <p
          data-hero-headline
          className="font-serif font-medium tracking-[-0.02em] text-lab-ink"
          style={{ fontSize: "clamp(2.25rem, 6.5vw, 3.75rem)", lineHeight: 1.08 }}
        >
          Antrenman, yazıya dökülür.
        </p>
        <p
          data-hero-deck
          className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Koçun programı yazar; sen salonda uygularsın. Her set, her kilo, her
          tekrar — hepsi deftere işlenir.
        </p>
        <div
          data-hero-deck
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="px-8">
            <Link href="/login">Giriş yap</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Davetin mi var?{" "}
            <span className="font-medium text-foreground">
              Bağlantındaki adresi aç.
            </span>
          </p>
        </div>
      </div>

      {/* Şekil 1 — the barbell, drawn as a journal figure. */}
      <figure data-hero-figure className="mx-auto mt-14 max-w-3xl sm:mt-20">
        <svg
          viewBox="0 0 640 210"
          role="img"
          aria-label="Şekil 1 — yüklü halter çizimi"
          className="w-full text-lab-ink"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {/* Bar */}
          <path data-draw d="M 24 105 H 616" strokeWidth="3" />
          {/* Knurl ticks at grip width */}
          <path data-draw d="M 250 98 V 112 M 390 98 V 112" strokeWidth="2" />
          {/* Collars */}
          <rect data-draw x="176" y="94" width="12" height="22" rx="3" />
          <rect data-draw x="452" y="94" width="12" height="22" rx="3" />
          {/* Left plates: 20 / 10 / 5 */}
          <rect data-draw x="140" y="28" width="24" height="154" rx="7" />
          <rect data-draw x="112" y="52" width="20" height="106" rx="6" />
          <rect data-draw x="90" y="76" width="14" height="58" rx="5" />
          {/* Right plates, mirrored */}
          <rect data-draw x="476" y="28" width="24" height="154" rx="7" />
          <rect data-draw x="508" y="52" width="20" height="106" rx="6" />
          <rect data-draw x="536" y="76" width="14" height="58" rx="5" />
          {/* Leader line to total weight */}
          <path
            data-draw
            d="M 488 22 C 510 4 544 4 566 12"
            strokeWidth="1.5"
            className="text-lab-green"
          />
          <text
            data-annotation
            x="572"
            y="16"
            className="fill-lab-green font-mono"
            stroke="none"
            fontSize="15"
            fontWeight="600"
          >
            92,5 kg
          </text>
          <text
            data-annotation
            x="320"
            y="140"
            textAnchor="middle"
            className="fill-current font-mono opacity-60"
            stroke="none"
            fontSize="12"
          >
            bar 20 kg
          </text>
        </svg>
        <figcaption className="text-label mt-4 text-center text-muted-foreground">
          Şekil 1 — Pazartesi, çalışma ağırlığı
        </figcaption>
      </figure>
    </section>
  );
}
