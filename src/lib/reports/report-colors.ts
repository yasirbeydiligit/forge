/**
 * Muscle-distribution colour system for the reports. A muted, editorial oklch
 * palette that sits calmly on the warm-paper canvas. Each muscle gets a stable
 * base hue (by slug); region segments within a muscle are lighter shades of that
 * same hue, so each bar reads as one colour family graded by sub-region.
 *
 * Colour is never the only signal — every segment is always labelled.
 */

type Hue = { l: number; c: number; h: number };

// Hues are spread across the wheel so adjacent muscles stay distinguishable.
const MUSCLE_HUES: Hue[] = [
  { l: 0.55, c: 0.11, h: 155 }, // deep green (primary family)
  { l: 0.54, c: 0.1, h: 248 }, // calm blue
  { l: 0.63, c: 0.11, h: 65 }, // ochre / amber
  { l: 0.52, c: 0.12, h: 330 }, // plum
  { l: 0.58, c: 0.09, h: 200 }, // teal
  { l: 0.57, c: 0.12, h: 32 }, // clay
  { l: 0.5, c: 0.11, h: 288 }, // indigo
  { l: 0.57, c: 0.12, h: 12 }, // rose
];

/** Neutral fill for primary sets without a region ("Diğer"). */
export const NEUTRAL_SEGMENT = "oklch(0.8 0.012 85)";

function hueFor(slug: string): Hue {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return MUSCLE_HUES[h % MUSCLE_HUES.length];
}

/** The muscle's base colour (used when it has no region breakdown). */
export function muscleColor(slug: string): string {
  const b = hueFor(slug);
  return `oklch(${b.l} ${b.c} ${b.h})`;
}

/**
 * Shade `i` of `n` for a muscle's region segments. i=0 (the largest region) is
 * the strongest/darkest; later regions lighten so the gradient reads as one
 * family.
 */
export function regionShade(slug: string, i: number, n: number): string {
  const base = hueFor(slug);
  const span = 0.2;
  const l = n <= 1 ? base.l : Math.min(0.82, base.l + (i / (n - 1)) * span);
  const c = Math.max(0.04, base.c - (i / Math.max(1, n - 1)) * 0.03);
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${base.h})`;
}
