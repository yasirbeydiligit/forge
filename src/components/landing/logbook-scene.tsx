"use client";

/**
 * Signature scene: "defter kendini yazar". A logbook page in the app's real
 * visual grammar fills itself in — set rows land, checks stamp, and the last
 * set earns a rotated PR stamp. On desktop the card pins and the timeline is
 * scrubbed by scroll; on mobile it plays once when it enters the viewport.
 * Without motion (or JS) the completed page is simply shown.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Check } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const SETS = [
  { no: 1, load: "92,5 kg × 5", rpe: "RPE 8" },
  { no: 2, load: "92,5 kg × 5", rpe: "RPE 8" },
  { no: 3, load: "92,5 kg × 5", rpe: "RPE 8,5" },
  { no: 4, load: "92,5 kg × 5", rpe: "RPE 8,5" },
  { no: 5, load: "92,5 kg × 5", rpe: "RPE 9", pr: true },
];

export function LogbookScene() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        desktop: "(min-width: 64rem)",
      },
      (context) => {
        const { motion, desktop } = context.conditions as {
          motion: boolean;
          desktop: boolean;
        };
        if (!motion) return;

        const ctx = gsap.context(() => {
          const tl = gsap.timeline({
            defaults: { ease: "power2.out" },
            scrollTrigger: desktop
              ? {
                  trigger: "[data-scene-pin]",
                  start: "top top",
                  end: "+=140%",
                  pin: true,
                  scrub: 0.4,
                }
              : {
                  trigger: "[data-scene-pin]",
                  start: "top 65%",
                  once: true,
                },
          });

          tl.from("[data-scene-head]", { autoAlpha: 0, y: 12, duration: 0.5 });
          root.querySelectorAll("[data-set-row]").forEach((row) => {
            tl.from(row, { autoAlpha: 0, y: 10, duration: 0.45 }, "+=0.12")
              .from(
                row.querySelector("[data-set-check]"),
                { scale: 0, rotation: -30, duration: 0.3, ease: "back.out(2.5)" },
                "-=0.15",
              );
          });
          tl.from(
            "[data-pr-stamp]",
            {
              autoAlpha: 0,
              scale: 1.7,
              rotation: 4,
              duration: 0.5,
              ease: "back.out(1.8)",
            },
            "+=0.15",
          ).from("[data-scene-foot]", { autoAlpha: 0, y: 8, duration: 0.45 }, "+=0.1");
        }, root);

        return () => ctx.revert();
      },
    );
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="defter-sahnesi"
      className="border-y border-border bg-surface/60"
    >
      <div
        data-scene-pin
        className="mx-auto flex w-full max-w-5xl flex-col justify-center px-4 py-20 sm:px-6 lg:min-h-[100svh] lg:py-0"
      >
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <p className="text-label text-muted-foreground">İmza sahne</p>
            <h2 id="defter-sahnesi" className="text-h1 mt-2 text-lab-ink">
              Defter kendini yazar
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Uygulamada gördüğün sayfa budur: hedef satırın önünde durur, sen
              doldurursun. Beşinci set bir rekora denk gelirse, sayfa bunu
              senden önce fark eder.
            </p>
          </div>

          {/* The logbook page, in real app grammar: PaperCard + mono data. */}
          <div className="relative rounded-xl border border-paper-border bg-paper p-5 text-paper-foreground paper-shadow sm:p-7">
            <div data-scene-head>
              <div className="text-label flex items-center justify-between text-muted-foreground">
                <span>Defter — 27. hafta · Pazartesi</span>
                <span className="font-mono">42 dk</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-b border-paper-border pb-3">
                <h3 className="text-h2 text-lab-ink">Back Squat</h3>
                <p className="font-mono text-xs text-muted-foreground">
                  Hedef 5×5 · 92,5 kg · RPE 8
                </p>
              </div>
            </div>

            <ol className="mt-2 divide-y divide-paper-border/70">
              {SETS.map((set) => (
                <li
                  key={set.no}
                  data-set-row
                  className="flex items-center gap-3 py-2.5 font-mono text-sm"
                >
                  <span className="w-7 text-xs text-muted-foreground">
                    S{set.no}
                  </span>
                  <span className="flex-1 tabular-nums">{set.load}</span>
                  <span
                    className={cn(
                      "text-xs",
                      set.pr ? "text-lab-green" : "text-muted-foreground",
                    )}
                  >
                    {set.rpe}
                  </span>
                  <span
                    data-set-check
                    className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                </li>
              ))}
            </ol>

            <div
              data-scene-foot
              className="mt-3 flex items-center justify-between border-t border-paper-border pt-3"
            >
              <span className="text-label text-muted-foreground">
                Oturum kaydı tamam
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                Tonaj 2.312 kg
              </span>
            </div>

            <div
              data-pr-stamp
              className="absolute -top-4 -right-3 -rotate-6 rounded-lg border-2 border-lab-green bg-paper px-3 py-1.5 shadow-raised sm:-right-6"
            >
              <span className="font-mono text-xs font-bold tracking-[0.14em] text-lab-green uppercase">
                PR · 92,5 kg × 5
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
