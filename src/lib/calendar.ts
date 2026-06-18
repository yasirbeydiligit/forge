import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { tr } from "date-fns/locale";

const MONTH_KEY = "yyyy-MM";

export function monthKeyOf(date: Date): string {
  return format(date, MONTH_KEY);
}

export function parseMonthKey(key: string | undefined): Date {
  if (!key) return startOfMonth(new Date());
  const parsed = parse(key, MONTH_KEY, new Date());
  return Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : parsed;
}

export function monthLabel(month: Date): string {
  return format(month, "MMMM yyyy", { locale: tr });
}

export function prevMonthKey(month: Date): string {
  return monthKeyOf(subMonths(month, 1));
}

export function nextMonthKey(month: Date): string {
  return monthKeyOf(addMonths(month, 1));
}

/** Six-week (Mon-first) matrix covering the given month. */
export function buildMonthMatrix(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}
