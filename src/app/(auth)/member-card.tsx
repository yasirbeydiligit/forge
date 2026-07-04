"use client";

/**
 * The journal's membership card, shared by login and kayıt: a paper card that
 * settles onto the desk (drop + slight rotation), a circular FORGE rubber
 * stamp pressing into the corner, a self-drawing barbell rule under the
 * serif greeting, and staggered content lines. Reduced motion: static card.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(DrawSVGPlugin);

function StampMark() {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden
      className="size-20 -rotate-12 text-lab-green opacity-80 sm:size-24"
      data-stamp
    >
      <defs>
        <path id="stamp-arc" d="M 48 14 A 34 34 0 1 1 47.9 14" fill="none" />
      </defs>
      <circle
        cx="48"
        cy="48"
        r="44"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle
        cx="48"
        cy="48"
        r="27"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        className="fill-current font-mono"
        fontSize="9.5"
        fontWeight="600"
        letterSpacing="2.5"
      >
        <textPath href="#stamp-arc" startOffset="0">
          FORGE · KAPALI TOPLULUK · SAYI 01 ·
        </textPath>
      </text>
      <text
        x="48"
        y="53"
        textAnchor="middle"
        className="fill-current font-serif"
        fontSize="15"
        fontWeight="600"
      >
        01
      </text>
    </svg>
  );
}

export function MemberCard({
  label,
  title,
  deck,
  children,
  footer,
}: {
  label: string;
  title: string;
  deck: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.from("[data-card]", {
          autoAlpha: 0,
          y: 22,
          rotation: -1.5,
          transformOrigin: "center",
          duration: 0.6,
        })
          .from(
            "[data-card-line]",
            { autoAlpha: 0, y: 8, duration: 0.4, stagger: 0.07 },
            "-=0.2",
          )
          .from(
            "[data-ornament]",
            { drawSVG: "0%", duration: 0.7, ease: "power1.inOut" },
            "-=0.3",
          )
          .from(
            "[data-stamp]",
            {
              autoAlpha: 0,
              scale: 1.6,
              rotation: 8,
              duration: 0.5,
              ease: "back.out(1.7)",
            },
            "-=0.25",
          );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <div
        data-card
        className="relative rounded-xl border border-paper-border bg-paper p-6 text-paper-foreground paper-shadow sm:p-7"
      >
        <p data-card-line className="text-label text-muted-foreground">
          {label}
        </p>

        <h1
          data-card-line
          className="mt-4 font-serif text-3xl font-medium tracking-tight text-lab-ink"
        >
          {title}
        </h1>
        <p
          data-card-line
          className="mt-1.5 font-serif text-base text-muted-foreground italic"
        >
          {deck}
        </p>

        {/* Barbell hairline rule, drawing itself in. */}
        <svg
          viewBox="0 0 320 18"
          aria-hidden
          className="mt-5 w-full text-lab-ink/60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path data-ornament d="M 4 9 H 316" />
          <path data-ornament d="M 116 4 V 14 M 124 2 V 16 M 196 4 V 14 M 188 2 V 16" />
        </svg>

        <div data-card-line className="mt-6">
          {children}
        </div>

        {footer ? (
          <div data-card-line className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}

        <div className="pointer-events-none absolute -top-6 right-3 sm:-top-8 sm:-right-8">
          <StampMark />
        </div>
      </div>
    </div>
  );
}
