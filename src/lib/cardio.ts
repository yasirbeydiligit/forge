/**
 * Cardio activity registry + pure weekly-summary helpers.
 *
 * Canonical machine values are the `cardio_activity` DB enum; Turkish labels
 * and icons live here (same pattern as src/lib/metrics.ts). Entries are kept
 * deliberately outside the workout-logging flow — this is the light layer the
 * /takip page and the coach panel read.
 */
import {
  Activity,
  Bike,
  Footprints,
  Orbit,
  Rabbit,
  Waves,
  type LucideIcon,
} from "lucide-react";

import type { Enums } from "@/lib/database.types";

export type CardioActivityKey = Enums<"cardio_activity">;

export const CARDIO_ACTIVITIES: {
  key: CardioActivityKey;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "walk", label: "Yürüyüş", icon: Footprints },
  { key: "run", label: "Koşu", icon: Rabbit },
  { key: "swim", label: "Yüzme", icon: Waves },
  { key: "bike", label: "Bisiklet", icon: Bike },
  { key: "elliptical", label: "Eliptik", icon: Orbit },
  { key: "other", label: "Diğer", icon: Activity },
];

export const CARDIO_LABEL_TR = Object.fromEntries(
  CARDIO_ACTIVITIES.map((a) => [a.key, a.label]),
) as Record<CardioActivityKey, string>;

export const CARDIO_ICON = Object.fromEntries(
  CARDIO_ACTIVITIES.map((a) => [a.key, a.icon]),
) as Record<CardioActivityKey, LucideIcon>;

/** The slice of a cardio row the summary needs (PG numerics arrive as strings). */
export type CardioEntry = {
  activity: CardioActivityKey;
  duration_min: number;
  distance_km: number | string | null;
  calories: number | null;
};

export type CardioWeeklySummary = {
  totalMin: number;
  count: number;
  /** Sum of logged distances, or null when no entry carries one. */
  totalKm: number | null;
  /** Activity with the most minutes, or null for an empty week. */
  topActivity: CardioActivityKey | null;
};

export function cardioWeeklySummary(
  entries: readonly CardioEntry[],
): CardioWeeklySummary {
  let totalMin = 0;
  let totalKm: number | null = null;
  const minutesBy = new Map<CardioActivityKey, number>();

  for (const e of entries) {
    totalMin += e.duration_min;
    minutesBy.set(e.activity, (minutesBy.get(e.activity) ?? 0) + e.duration_min);
    const km = e.distance_km == null ? NaN : Number(e.distance_km);
    if (Number.isFinite(km)) totalKm = (totalKm ?? 0) + km;
  }

  let topActivity: CardioActivityKey | null = null;
  let topMin = 0;
  for (const [key, min] of minutesBy) {
    if (min > topMin) {
      topActivity = key;
      topMin = min;
    }
  }

  return { totalMin, count: entries.length, totalKm, topActivity };
}

/** `95 → "1 s 35 dk"`, `120 → "2 s"`, `45 → "45 dk"`. */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} s ${m} dk` : `${h} s`;
}
