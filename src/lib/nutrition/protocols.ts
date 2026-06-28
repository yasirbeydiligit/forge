/**
 * Supplement / timing protocol presentation helpers. The DB stores the timing as
 * a machine enum (protocol_timing); Turkish labels and the day-timeline ordering
 * live here so the UI and reports stay consistent.
 */

export const PROTOCOL_TIMING_ORDER = [
  "morning",
  "pre_workout",
  "intra_workout",
  "post_workout",
  "night",
] as const;

export type ProtocolTiming = (typeof PROTOCOL_TIMING_ORDER)[number];

export const PROTOCOL_TIMING_LABEL_TR: Record<ProtocolTiming, string> = {
  morning: "Sabah (kalkınca)",
  pre_workout: "Antrenman öncesi",
  intra_workout: "Antrenman içi",
  post_workout: "Antrenman sonrası",
  night: "Gece (yatarken)",
};

const rank = (t: string) =>
  PROTOCOL_TIMING_ORDER.indexOf(t as ProtocolTiming);

/** Order protocols along the day (timing slot), then by their order_index. */
export function sortByTiming<
  T extends { timing: string; order_index: number },
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => rank(a.timing) - rank(b.timing) || a.order_index - b.order_index,
  );
}
