/**
 * Forge Gazete period math — pure date logic deciding which issues are due.
 *
 * duePeriods is the single source of truth for both lazy generation and the
 * nav "new issue" signal: weeklies are windowed to the last
 * WEEKLY_BACKFILL_LIMIT closed weeks (older weeks fall out of the window and
 * are never due again), months backfill fully, milestones are anchored to the
 * athlete's journey start (3/6/9/12, then every anniversary).
 */
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  startOfISOWeek,
  startOfMonth,
} from "date-fns";
import { tr } from "date-fns/locale";

import { parseDateKey, toDateKey } from "@/lib/format";

export const WEEKLY_BACKFILL_LIMIT = 8;
export const MILESTONES = [3, 6, 9, 12] as const;

export type Period =
  | { type: "weekly" | "monthly"; start: string; end: string }
  | { type: "milestone"; start: string; end: string; months: number };

/** Stable identity used to match printed rows: `${period_type}:${period_end}`. */
export function periodKey(p: Period): string {
  return `${p.type}:${p.end}`;
}

function closedWeeks(journeyStart: string, today: string): Period[] {
  const out: Period[] = [];
  let cursor = startOfISOWeek(parseDateKey(journeyStart));
  for (;;) {
    const start = toDateKey(cursor);
    const end = toDateKey(addDays(cursor, 6));
    if (!(end < today)) break; // week still open (Sunday inclusive)
    out.push({ type: "weekly", start, end });
    cursor = addWeeks(cursor, 1);
  }
  return out.slice(-WEEKLY_BACKFILL_LIMIT);
}

function closedMonths(journeyStart: string, today: string): Period[] {
  const out: Period[] = [];
  let cursor = startOfMonth(parseDateKey(journeyStart));
  for (;;) {
    const start = toDateKey(cursor);
    const end = toDateKey(endOfMonth(cursor));
    if (!(end < today)) break;
    out.push({ type: "monthly", start, end });
    cursor = startOfMonth(addMonths(cursor, 1));
  }
  return out;
}

function milestoneMonthsSeq(uptoMonths: number): number[] {
  const seq = [...MILESTONES] as number[];
  for (let m = 24; m <= uptoMonths; m += 12) seq.push(m);
  return seq;
}

function dueMilestones(journeyStart: string, today: string): Period[] {
  const startDate = parseDateKey(journeyStart);
  const out: Period[] = [];
  // Generous upper bound: months elapsed + 12.
  const yearsBound =
    (parseDateKey(today).getFullYear() - startDate.getFullYear() + 2) * 12;
  for (const months of milestoneMonthsSeq(yearsBound)) {
    const end = toDateKey(addMonths(startDate, months));
    if (end <= today) {
      out.push({ type: "milestone", start: journeyStart, end, months });
    }
  }
  return out;
}

/**
 * Every period whose issue should exist right now, chronological by end date,
 * with already-printed periods removed. `printed` holds periodKey() strings.
 */
export function duePeriods(
  journeyStart: string,
  today: string,
  printed: Set<string>,
): Period[] {
  const all = [
    ...closedWeeks(journeyStart, today),
    ...closedMonths(journeyStart, today),
    ...dueMilestones(journeyStart, today),
  ];
  return all
    .filter((p) => !printed.has(periodKey(p)))
    .sort((a, b) => a.end.localeCompare(b.end));
}

/** The next milestone still ahead of `after` (an issue's period end). */
export function nextMilestone(
  journeyStart: string,
  after: string,
): { months: number; dueDate: string } | null {
  const startDate = parseDateKey(journeyStart);
  const yearsBound =
    (parseDateKey(after).getFullYear() - startDate.getFullYear() + 3) * 12;
  for (const months of milestoneMonthsSeq(yearsBound)) {
    const dueDate = toDateKey(addMonths(startDate, months));
    if (dueDate > after) return { months, dueDate };
  }
  return null;
}

export function periodLabel(p: Period): string {
  if (p.type === "milestone") return `${p.months}. Ay Özel Sayısı`;
  if (p.type === "monthly") {
    return format(parseDateKey(p.start), "MMMM yyyy", { locale: tr });
  }
  const start = parseDateKey(p.start);
  const end = parseDateKey(p.end);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const startLabel = format(start, sameMonth ? "d" : "d MMMM", { locale: tr });
  return `${startLabel} – ${format(end, "d MMMM yyyy", { locale: tr })}`;
}
