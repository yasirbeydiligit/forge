/**
 * Pure builder for the Bugün page's weekly calendar strip. Merges the week's
 * planned assignments and completed-session dates onto each day key, so the
 * client strip is a dumb renderer. Date maths stays in the page (date-fns);
 * this stays framework-free and unit-testable.
 */

export type WeekStripAssignment = {
  scheduled_date: string;
  workout: { name: string } | null;
};

export type WeekDayCell = {
  /** "YYYY-MM-DD" */
  date: string;
  isToday: boolean;
  /** Strictly before today (dimmed in the strip). */
  isPast: boolean;
  /** Has at least one planned assignment. */
  planned: boolean;
  /** A completed session landed on this day (done, even without a plan). */
  completed: boolean;
  /** Planned workout names in input order (null workouts skipped). */
  workoutNames: string[];
};

export function buildWeekStrip({
  days,
  todayKey,
  assignments,
  completedDates,
}: {
  days: string[];
  todayKey: string;
  assignments: readonly WeekStripAssignment[];
  completedDates: readonly string[];
}): WeekDayCell[] {
  const namesByDate = new Map<string, string[]>();
  for (const a of assignments) {
    const list = namesByDate.get(a.scheduled_date) ?? [];
    if (a.workout?.name) list.push(a.workout.name);
    namesByDate.set(a.scheduled_date, list);
  }
  const done = new Set(completedDates);

  return days.map((date) => ({
    date,
    isToday: date === todayKey,
    isPast: date < todayKey,
    planned: namesByDate.has(date),
    completed: done.has(date),
    workoutNames: namesByDate.get(date) ?? [],
  }));
}
