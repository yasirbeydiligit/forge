"use client";

/**
 * Milestone/monthly physique comparison: the two photos sit side by side with
 * mono date + weight captions; a clip-path curtain reveals them on scroll.
 * Photos arrive as freshly signed URLs (never stored in the payload).
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import type { IssuePayload } from "@/lib/gazete/build-issue";
import { formatDate } from "@/lib/format";

gsap.registerPlugin(ScrollTrigger);

export function PhotoCompare({
  photos,
  urls,
}: {
  photos: NonNullable<IssuePayload["photos"]>;
  urls: { before: string; after: string };
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(root.querySelectorAll("[data-photo-panel]"), {
          clipPath: "inset(0 0 100% 0)",
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.18,
          scrollTrigger: { trigger: root, start: "top 75%", once: true },
        });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  const panels = [
    { url: urls.before, date: photos.beforeDate, weight: photos.beforeWeightKg, label: "Önce" },
    { url: urls.after, date: photos.afterDate, weight: photos.afterWeightKg, label: "Sonra" },
  ];

  return (
    <div ref={rootRef} className="grid grid-cols-2 gap-3">
      {panels.map((p) => (
        <figure key={p.label} data-photo-panel className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-paper-border bg-muted">
            {/* Signed, short-lived URL from the private bucket — next/image
                optimization would proxy/cache it, so a plain img is correct. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={`${p.label} — ${formatDate(p.date)}`}
              className="aspect-[3/4] w-full object-cover"
              loading="lazy"
            />
          </div>
          <figcaption className="mt-1.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="font-bold text-lab-ink">{p.label}</span>
            <span>
              {formatDate(p.date, "d MMM yyyy")}
              {p.weight != null ? ` · ${p.weight.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} kg` : ""}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
