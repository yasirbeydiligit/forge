"use client";

/**
 * Register ticker: a hairline-bounded mono marquee of logbook specimens, like
 * the running data strip of a printed register. Two identical copies scroll
 * with a seamless -50% loop; with reduced motion the strip stands still (the
 * first copy alone already fills and overflows quietly).
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

/* Pre-uppercased: CSS `uppercase` under lang="tr" would dot the I of the
 * English lift names (DEADLİFT). */
const ITEMS = [
  "SQUAT 5×5 · 92,5 KG · RPE 8",
  "BENCH 4×6 · 72,5 KG · RPE 7",
  "DEADLIFT 3×3 · 140 KG · RPE 8",
  "OHP 4×8 · 42,5 KG",
  "SU 2,5 L / 3 L",
  "PAUSE SQUAT 3×5 · 80 KG",
  "UYKU 7 SA 40 DK",
  "PROTEIN 156 G",
  "ROW 4×10 · 60 KG",
];

function Strip({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center"
    >
      {ITEMS.map((item) => (
        <span
          key={item}
          className="flex items-center font-mono text-[0.6875rem] font-medium tracking-[0.14em] whitespace-nowrap text-muted-foreground"
        >
          <span className="px-5">{item}</span>
          <span aria-hidden className="text-lab-green">
            ▸
          </span>
        </span>
      ))}
    </div>
  );
}

export function RegisterTicker() {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tween = gsap.to(rowRef.current, {
        xPercent: -50,
        duration: 36,
        ease: "none",
        repeat: -1,
      });
      return () => {
        tween.kill();
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="mt-16 overflow-hidden border-y border-border py-2.5 sm:mt-20">
      <div ref={rowRef} className="flex w-max">
        <Strip />
        <Strip ariaHidden />
      </div>
    </div>
  );
}
