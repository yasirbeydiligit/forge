"use client";

import { useEffect } from "react";

/**
 * Reads `#chunk-<id>` from the URL hash on mount, scrolls that block into
 * view and applies a brief highlight ring that fades out. Dependency-free;
 * uses the existing lab tokens via the `data-highlight` styling hook below.
 */
export function ChunkHighlight() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#chunk-")) return;

    // `CSS.escape` keeps non-trivial ids (e.g. UUIDs) selector-safe.
    const el = document.querySelector<HTMLElement>(
      `#${CSS.escape(hash.slice(1))}`,
    );
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Ring + tint applied immediately, removed after the transition window so
    // the chunk settles back into the page.
    el.classList.add(
      "ring-2",
      "ring-lab-link/60",
      "bg-lab-link/5",
      "transition-[background-color,box-shadow]",
      "duration-700",
    );

    const timer = window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-lab-link/60", "bg-lab-link/5");
    }, 2500);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
