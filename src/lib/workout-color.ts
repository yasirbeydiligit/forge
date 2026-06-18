/**
 * Deterministic, muted accent colour for a workout label. Until the bespoke
 * muscle-group/category data exists, we hash the workout name to a stable hue
 * from a small editorial palette — so "Gün B — Çekiş" always gets the same dot,
 * hinting at a muscle group at a glance without overstating it.
 *
 * Returns a raw CSS colour string for inline `style` (dots / stripes).
 */
const PALETTE = [
  "oklch(0.5 0.11 152)", // green
  "oklch(0.5 0.12 245)", // blue
  "oklch(0.58 0.12 65)", // amber
  "oklch(0.5 0.11 290)", // violet
  "oklch(0.55 0.12 25)", // clay
  "oklch(0.52 0.09 200)", // teal
] as const;

export function workoutColor(name: string | null | undefined): string {
  const key = name ?? "";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
