import { describe, expect, it } from "vitest";

import { buildNutritionWeekly } from "./nutrition-weekly";

const WEEK = [
  "2026-06-22",
  "2026-06-23",
  "2026-06-24",
  "2026-06-25",
  "2026-06-26",
  "2026-06-27",
  "2026-06-28",
];

const target = { kcal: 2000, protein: 150, carbs: 200, fat: 60 };

const meals = [
  // out of order on purpose — the builder sorts by time
  { meal_date: "2026-06-22", eaten_at: "13:00:00", name: "Öğle", kcal: 700, protein: 50, carbs: 70, fat: 20 },
  { meal_date: "2026-06-22", eaten_at: "08:00:00", name: "Kahvaltı", kcal: 500, protein: 30, carbs: 60, fat: 15 },
  { meal_date: "2026-06-23", eaten_at: null, name: "Tek öğün", kcal: 2000, protein: 150, carbs: 200, fat: 60 },
];

const assignments = [
  { protocol_id: "x", name: "Kreatin", timing: "morning" },
  { protocol_id: "y", name: "Kafein", timing: "pre_workout" },
];

const completions = [
  { protocol_id: "x", completion_date: "2026-06-22", completed_at: "2026-06-22T08:05:00Z" },
];

describe("buildNutritionWeekly", () => {
  const report = buildNutritionWeekly({
    weekDates: WEEK,
    meals,
    target,
    assignments,
    completions,
  });

  it("emits one day per week date", () => {
    expect(report.days).toHaveLength(7);
    expect(report.days.map((d) => d.date)).toEqual(WEEK);
  });

  it("sums macros per day", () => {
    const d0 = report.days[0];
    expect(d0.totals).toEqual({ kcal: 1200, protein: 80, carbs: 130, fat: 35 });
    const empty = report.days[2]; // 2026-06-24, no meals
    expect(empty.totals).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("orders meals by time and trims to HH:MM", () => {
    expect(report.days[0].meals.map((m) => m.time)).toEqual(["08:00", "13:00"]);
    expect(report.days[0].meals[0].name).toBe("Kahvaltı");
    expect(report.days[1].meals[0].time).toBeNull();
  });

  it("flags kcal hit within 90-110% and macros at the 90% floor", () => {
    expect(report.days[0].hit.kcal).toBe(false); // 60%
    expect(report.days[0].hit.protein).toBe(false);
    expect(report.days[1].hit.kcal).toBe(true); // 100%
    expect(report.days[1].hit.protein).toBe(true);
    expect(report.days[1].hit.carbs).toBe(true);
    expect(report.days[1].hit.fat).toBe(true);
  });

  it("returns null hit flags when there is no target", () => {
    const noTarget = buildNutritionWeekly({
      weekDates: WEEK,
      meals,
      target: null,
      assignments: [],
      completions: [],
    });
    expect(noTarget.days[1].hit).toEqual({
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
    });
  });

  it("reports protocol compliance per day", () => {
    const d0 = report.days[0];
    expect(d0.protocolsTotal).toBe(2);
    expect(d0.protocolsDone).toBe(1);
    const x = d0.protocols.find((p) => p.protocolId === "x");
    expect(x?.done).toBe(true);
    expect(x?.at).toBe("2026-06-22T08:05:00Z");
    expect(d0.protocols.find((p) => p.protocolId === "y")?.done).toBe(false);

    const d1 = report.days[1];
    expect(d1.protocolsDone).toBe(0);
    expect(d1.protocolsTotal).toBe(2);
  });

  it("aggregates week totals and averages over logged days only", () => {
    expect(report.weekTotals.kcal).toBe(3200);
    expect(report.daysLogged).toBe(2);
    expect(report.avgKcal).toBe(1600);
  });

  it("avoids dividing by zero when nothing is logged", () => {
    const blank = buildNutritionWeekly({
      weekDates: WEEK,
      meals: [],
      target,
      assignments,
      completions: [],
    });
    expect(blank.daysLogged).toBe(0);
    expect(blank.avgKcal).toBe(0);
  });
});
