import { format, formatDistanceToNow, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

/** A date as a stable yyyy-MM-dd key (used for calendar columns / queries). */
export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

export function formatDate(value: string | Date, pattern = "d MMMM yyyy"): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: tr });
}

export function formatRelative(value: string | Date): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return formatDistanceToNow(date, { addSuffix: true, locale: tr });
}

/** Render a numeric DB value (which Postgres returns as string) nicely. */
export function formatNumber(
  value: number | string | null | undefined,
  suffix = "",
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return suffix ? `${text}${suffix}` : text;
}

/** Up-to-two-letter uppercase initials for an avatar fallback. Lives here (not
 * in a "use client" module) so server components can call it too. */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatRepRange(
  min: number | null,
  max: number | null,
): string | null {
  if (min && max) return min === max ? `${min}` : `${min}–${max}`;
  if (min) return `${min}+`;
  if (max) return `${max}`;
  return null;
}

export function formatRest(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  if (seconds < 60) return `${seconds} sn`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} dk ${s} sn` : `${m} dk`;
}

const TR_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const TR_DAYS_LONG = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];

/** Monday-first weekday labels for calendar headers. */
export const WEEKDAY_LABELS = TR_DAYS;
export const WEEKDAY_LABELS_LONG = TR_DAYS_LONG;
