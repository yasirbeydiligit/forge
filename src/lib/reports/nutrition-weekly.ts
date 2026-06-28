/**
 * Pure builder for a coach's weekly nutrition + protocol-compliance view of one
 * athlete. UI-agnostic and fully unit-tested; the server loader feeds it rows
 * and the view renders the result. "Hit" thresholds: total calories within
 * 90–110% of target, each macro at/above a 90% floor.
 */

export const KCAL_BAND_LOW = 0.9;
export const KCAL_BAND_HIGH = 1.1;
export const MACRO_FLOOR = 0.9;

export type DayMacros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MealLine = { time: string | null; name: string; kcal: number };

export type ProtocolDay = {
  protocolId: string;
  name: string;
  timing: string;
  done: boolean;
  at: string | null;
};

export type NutritionDay = {
  date: string;
  meals: MealLine[];
  totals: DayMacros;
  target: DayMacros | null;
  hit: {
    kcal: boolean | null;
    protein: boolean | null;
    carbs: boolean | null;
    fat: boolean | null;
  };
  protocols: ProtocolDay[];
  protocolsDone: number;
  protocolsTotal: number;
};

export type NutritionWeeklyReport = {
  days: NutritionDay[];
  weekTotals: DayMacros;
  avgKcal: number;
  daysLogged: number;
};

export type WeeklyMeal = {
  meal_date: string;
  eaten_at: string | null;
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export type WeeklyTarget = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
} | null;

export type WeeklyAssignment = {
  protocol_id: string;
  name: string;
  timing: string;
};

export type WeeklyCompletion = {
  protocol_id: string;
  completion_date: string;
  completed_at: string | null;
};

const ZERO: DayMacros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const num = (v: number | null) => v ?? 0;

/** kcal must land inside the band; macros only need to clear the floor. */
function hitBand(total: number, target: number | null): boolean | null {
  if (!target || target <= 0) return null;
  const r = total / target;
  return r >= KCAL_BAND_LOW && r <= KCAL_BAND_HIGH;
}
function hitFloor(total: number, target: number | null): boolean | null {
  if (!target || target <= 0) return null;
  return total / target >= MACRO_FLOOR;
}

export function buildNutritionWeekly(input: {
  weekDates: string[];
  meals: WeeklyMeal[];
  target: WeeklyTarget;
  assignments: WeeklyAssignment[];
  completions: WeeklyCompletion[];
}): NutritionWeeklyReport {
  const { weekDates, meals, target, assignments, completions } = input;

  // completion lookup: `${protocolId}\n${date}` -> completed_at
  const doneAt = new Map<string, string | null>();
  for (const c of completions) {
    doneAt.set(`${c.protocol_id}\n${c.completion_date}`, c.completed_at);
  }

  const dayTarget: DayMacros | null = target
    ? {
        kcal: num(target.kcal),
        protein: num(target.protein),
        carbs: num(target.carbs),
        fat: num(target.fat),
      }
    : null;

  const days: NutritionDay[] = weekDates.map((date) => {
    const dayMeals = meals
      .filter((m) => m.meal_date === date)
      .sort((a, b) => (a.eaten_at ?? "99:99").localeCompare(b.eaten_at ?? "99:99"));

    const totals: DayMacros = dayMeals.reduce(
      (acc, m) => ({
        kcal: acc.kcal + num(m.kcal),
        protein: acc.protein + num(m.protein),
        carbs: acc.carbs + num(m.carbs),
        fat: acc.fat + num(m.fat),
      }),
      { ...ZERO },
    );

    const protocols: ProtocolDay[] = assignments.map((a) => {
      const key = `${a.protocol_id}\n${date}`;
      const done = doneAt.has(key);
      return {
        protocolId: a.protocol_id,
        name: a.name,
        timing: a.timing,
        done,
        at: done ? (doneAt.get(key) ?? null) : null,
      };
    });

    return {
      date,
      meals: dayMeals.map((m) => ({
        time: m.eaten_at ? m.eaten_at.slice(0, 5) : null,
        name: m.name,
        kcal: num(m.kcal),
      })),
      totals,
      target: dayTarget,
      hit: {
        kcal: hitBand(totals.kcal, dayTarget?.kcal ?? null),
        protein: hitFloor(totals.protein, dayTarget?.protein ?? null),
        carbs: hitFloor(totals.carbs, dayTarget?.carbs ?? null),
        fat: hitFloor(totals.fat, dayTarget?.fat ?? null),
      },
      protocols,
      protocolsDone: protocols.filter((p) => p.done).length,
      protocolsTotal: protocols.length,
    };
  });

  const weekTotals = days.reduce(
    (acc, d) => ({
      kcal: acc.kcal + d.totals.kcal,
      protein: acc.protein + d.totals.protein,
      carbs: acc.carbs + d.totals.carbs,
      fat: acc.fat + d.totals.fat,
    }),
    { ...ZERO },
  );

  const daysLogged = days.filter((d) => d.meals.length > 0).length;
  const avgKcal = daysLogged > 0 ? Math.round(weekTotals.kcal / daysLogged) : 0;

  return { days, weekTotals, avgKcal, daysLogged };
}
