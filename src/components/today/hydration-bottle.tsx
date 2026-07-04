"use client";

/**
 * Hydration as a living object: an SVG bottle whose water is a pair of scrolling
 * sine waves (GSAP), rising toward the daily goal as glasses are added. Reuses
 * the beslenme `adjustWater` action with an optimistic value so the level moves
 * instantly. Shared between Bugün (hero) and Beslenme (compact) via `variant`.
 * With prefers-reduced-motion the waves stand still and the level jumps.
 */
import { useEffect, useRef } from "react";
import { useOptimistic, useTransition } from "react";
import gsap from "gsap";
import { Droplet, Minus, Plus } from "lucide-react";

import { adjustWater } from "@/app/(app)/beslenme/actions";
import { PaperCard, SectionLabel } from "@/components/lab/lab";
import { cn } from "@/lib/utils";

const STEP = 250; // one glass, in millilitres

// Bottle interior geometry (SVG user units).
const IW = 60;
const TOP = 4;
const INNER_H = 92;

/** A filled, tiled sine wave path 2× the interior wide, for seamless scroll. */
function wavePath(width: number, amp: number, halfPeriod: number): string {
  let d = "M 0 0";
  let x = 0;
  let up = true;
  while (x < width) {
    d += ` q ${halfPeriod / 2} ${up ? -amp * 2 : amp * 2} ${halfPeriod} 0`;
    x += halfPeriod;
    up = !up;
  }
  return `${d} L ${x} 240 L 0 240 Z`;
}

const WAVE_BACK = wavePath(IW * 2, 2.6, 15);
const WAVE_FRONT = wavePath(IW * 2, 2.0, 20);

export function HydrationBottle({
  date,
  current,
  target,
  variant = "hero",
}: {
  date: string;
  current: number;
  target: number | null;
  variant?: "hero" | "compact";
}) {
  const goal = target && target > 0 ? target : 3000;
  const [value, addOptimistic] = useOptimistic(
    current,
    (state, delta: number) => Math.max(0, state + delta),
  );
  const [, startTransition] = useTransition();

  const pct = Math.min(1, value / goal);
  const surfaceY = TOP + (1 - pct) * INNER_H;

  const groupRef = useRef<SVGGElement>(null);
  const backRef = useRef<SVGPathElement>(null);
  const frontRef = useRef<SVGPathElement>(null);
  const bottleRef = useRef<HTMLDivElement>(null);
  const prevValue = useRef(value);

  // Perpetual horizontal scroll of the two waves (mount once).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.to(backRef.current, {
        x: -IW,
        duration: 3.4,
        ease: "none",
        repeat: -1,
      });
      gsap.to(frontRef.current, {
        x: -IW,
        duration: 5.2,
        ease: "none",
        repeat: -1,
      });
    });
    return () => ctx.revert();
  }, []);

  // Raise/lower the water to the current level whenever the value changes.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(g, { y: surfaceY });
    } else {
      gsap.to(g, { y: surfaceY, duration: 0.6, ease: "power2.out" });
      // A small pop when a glass is added.
      if (value > prevValue.current && bottleRef.current) {
        gsap.fromTo(
          bottleRef.current,
          { scale: 1 },
          { scale: 1.05, duration: 0.14, ease: "power2.out", yoyo: true, repeat: 1 },
        );
      }
    }
    prevValue.current = value;
  }, [value, surfaceY]);

  function change(delta: number) {
    startTransition(async () => {
      addOptimistic(delta);
      const fd = new FormData();
      fd.set("date", date);
      fd.set("delta", String(delta));
      await adjustWater(fd);
    });
  }

  const glasses = Math.round(value / STEP);
  const goalGlasses = Math.round(goal / STEP);
  const fmtL = (ml: number) =>
    (ml / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 });

  const isHero = variant === "hero";

  return (
    <PaperCard className={cn("flex items-center gap-5", isHero ? "p-5" : "p-4")}>
      {/* The bottle */}
      <div
        ref={bottleRef}
        className={cn("relative shrink-0", isHero ? "h-32 w-[5.5rem]" : "h-24 w-16")}
      >
        <svg
          viewBox="0 0 60 100"
          className="h-full w-full"
          role="img"
          aria-label={`Hidrasyon: ${fmtL(value)} / ${fmtL(goal)} litre`}
        >
          <defs>
            <clipPath id={`bottle-${variant}`}>
              <rect x="2" y={TOP} width={IW - 4} height={INNER_H} rx="12" />
            </clipPath>
          </defs>

          {/* Interior wash */}
          <rect
            x="2"
            y={TOP}
            width={IW - 4}
            height={INNER_H}
            rx="12"
            className="fill-lab-blue/[0.06]"
          />

          {/* Water */}
          <g clipPath={`url(#bottle-${variant})`}>
            <g ref={groupRef} transform={`translate(0 ${surfaceY})`}>
              <path ref={backRef} d={WAVE_BACK} className="fill-lab-blue/25" />
              <path ref={frontRef} d={WAVE_FRONT} className="fill-lab-blue/40" />
            </g>
          </g>

          {/* Glass outline */}
          <rect
            x="2"
            y={TOP}
            width={IW - 4}
            height={INNER_H}
            rx="12"
            fill="none"
            className="stroke-lab-blue/30"
            strokeWidth="2"
          />
        </svg>
        <Droplet
          className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-lab-blue/70"
          aria-hidden
        />
      </div>

      {/* Numbers + controls */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <SectionLabel className="text-paper-muted">Hidrasyon</SectionLabel>
          <span className="font-mono text-xs tabular-nums text-paper-muted">
            {glasses} / {goalGlasses} bardak
          </span>
        </div>
        <p
          className={cn(
            "mt-1 font-serif tabular-nums text-paper-foreground",
            isHero ? "text-3xl" : "text-2xl",
          )}
        >
          {fmtL(value)}
          <span className="text-xl text-paper-muted"> / {fmtL(goal)}</span>
          <span className="ml-1 text-sm font-normal text-paper-muted">L</span>
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => change(STEP)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-lab-blue/10 px-4 text-sm font-medium text-lab-blue transition-[background-color,transform] duration-[var(--dur-fast)] ease-soft hover:bg-lab-blue/15 active:scale-[0.98]"
          >
            <Plus className="size-4" />
            1 bardak
            <span className="font-mono text-xs opacity-70">+250 ml</span>
          </button>
          <button
            type="button"
            onClick={() => change(-STEP)}
            disabled={value <= 0}
            aria-label="Bir bardak geri al"
            className="inline-flex size-11 items-center justify-center rounded-full border border-paper-border text-paper-muted transition-colors duration-[var(--dur-fast)] hover:text-foreground disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
        </div>
      </div>
    </PaperCard>
  );
}
