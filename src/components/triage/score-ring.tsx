"use client";

/**
 * Animated "durum" ring: a serif hero number inside an SVG arc that fills to
 * the athlete's 0–100 triage score. GSAP draws the arc + counts the number up
 * on mount; with prefers-reduced-motion everything renders at its final state.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

import type { TriageBand } from "@/lib/triage/types";
import { cn } from "@/lib/utils";

const BAND_COLOR: Record<TriageBand, string> = {
  green: "var(--lab-green)",
  amber: "var(--lab-amber)",
  red: "var(--lab-rose)",
};

export function ScoreRing({
  score,
  band,
  size = 56,
  className,
}: {
  score: number;
  band: TriageBand;
  size?: number;
  className?: string;
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const target = circumference * (1 - score / 100);

  useEffect(() => {
    const arc = arcRef.current;
    const num = numRef.current;
    if (!arc || !num) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const counter = { value: 0 };
    const ctx = gsap.context(() => {
      gsap.fromTo(
        arc,
        { strokeDashoffset: circumference },
        { strokeDashoffset: target, duration: 0.9, ease: "power2.out" },
      );
      gsap.to(counter, {
        value: score,
        duration: 0.9,
        ease: "power2.out",
        onUpdate: () => {
          num.textContent = String(Math.round(counter.value));
        },
      });
    });
    return () => ctx.revert();
  }, [circumference, target, score]);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Durum skoru ${score}/100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface)"
          strokeWidth={stroke}
        />
        {/* score 0 draws nothing — a rounded cap would leave a stray dot. */}
        {score > 0 ? (
          <circle
            ref={arcRef}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={BAND_COLOR[band]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={target}
          />
        ) : null}
      </svg>
      <span
        ref={numRef}
        className="absolute inset-0 flex items-center justify-center font-serif text-lg tabular-nums text-paper-foreground"
      >
        {score}
      </span>
    </div>
  );
}
