import { describe, expect, it } from "vitest";

import { aggregatePeriod, type AggregateRows } from "./aggregate";
import type { Period } from "./periods";

const WEEK: Period = { type: "weekly", start: "2026-06-29", end: "2026-07-05" };

function emptyRows(): AggregateRows {
  return {
    sessions: [],
    sets: [],
    historyExerciseIds: new Set(),
    prHistorySets: [],
    metricDays: [],
    mealDays: [],
    target: null,
    cardio: [],
    protocol: { due: 0, done: 0 },
    weeklyTargetDays: null,
  };
}

/** Shorthand: a set row with taxonomy fields defaulted. */
function setRow(
  over: Partial<AggregateRows["sets"][number]> & {
    sessionId: string;
    exerciseId: string;
    date: string;
  },
): AggregateRows["sets"][number] {
  return {
    exerciseName: "Egzersiz",
    weight: null,
    reps: null,
    rir: null,
    region: null,
    muscles: [],
    ...over,
  };
}

function metricDay(
  over: Partial<AggregateRows["metricDays"][number]> & { date: string },
): AggregateRows["metricDays"][number] {
  return {
    weight: null,
    sleepHours: null,
    restingHr: null,
    energy: null,
    hunger: null,
    adherence: null,
    digestion: null,
    steps: null,
    waterMl: null,
    ...over,
  };
}

describe("aggregatePeriod — antrenman", () => {
  it("set/seans sayar; set/seans oranı ve ortalama RIR hesaplanır", () => {
    const rows = emptyRows();
    rows.sessions = [
      { id: "s1", date: "2026-06-29", completed: true },
      { id: "s2", date: "2026-07-01", completed: true },
    ];
    rows.sets = [
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29", weight: 100, reps: 5, rir: 2 }),
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29", weight: null, reps: 12, rir: 3 }),
      setRow({ sessionId: "s2", exerciseId: "e2", date: "2026-07-01", weight: 120, reps: 3, rir: 1 }),
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.sessionsCompleted).toBe(2);
    expect(agg.totalSets).toBe(3);
    expect(agg.setsPerSession).toBe(1.5);
    expect(agg.avgRir).toBe(2);
  });

  it("RIR hiç loglanmadıysa avgRir null; seans yoksa setsPerSession null", () => {
    const rows = emptyRows();
    rows.sets = [setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29" })];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.avgRir).toBeNull();
    expect(agg.setsPerSession).toBeNull();
  });

  it("kas bazında set: primary rol, set başına kas BİR kez (iki fonksiyon olsa da), desc sıralı", () => {
    const rows = emptyRows();
    const chestTwice = [
      { slug: "chest", nameTr: "Göğüs", role: "primary" as const },
      { slug: "chest", nameTr: "Göğüs", role: "primary" as const }, // 2. fonksiyon, aynı kas
      { slug: "triceps", nameTr: "Triceps", role: "secondary" as const },
    ];
    const back = [{ slug: "lats", nameTr: "Kanat", role: "primary" as const }];
    rows.sets = [
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29", muscles: chestTwice }),
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29", muscles: chestTwice }),
      setRow({ sessionId: "s1", exerciseId: "e2", date: "2026-06-29", muscles: back }),
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.muscleSets).toEqual([
      { muscle: "Göğüs", sets: 2 },
      { muscle: "Kanat", sets: 1 },
    ]); // secondary tabloya girmez; çift fonksiyon çift saymaz
  });

  it("bölge bazında set: her setin egzersiz bölgesi bir kez; bölgesiz setler atlanır", () => {
    const rows = emptyRows();
    rows.sets = [
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29", region: "Üst Göğüs" }),
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29", region: "Üst Göğüs" }),
      setRow({ sessionId: "s1", exerciseId: "e2", date: "2026-06-29", region: "Sırt Orta" }),
      setRow({ sessionId: "s1", exerciseId: "e3", date: "2026-06-29", region: null }),
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.regionSets).toEqual([
      { region: "Üst Göğüs", sets: 2 },
      { region: "Sırt Orta", sets: 1 },
    ]);
  });

  it("bestSession set sayısına göre; spark set bucket'ları", () => {
    const rows = emptyRows();
    rows.sessions = [
      { id: "s1", date: "2026-06-29", completed: true },
      { id: "s2", date: "2026-07-04", completed: true },
    ];
    rows.sets = [
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-29", weight: 100, reps: 5 }),
      setRow({ sessionId: "s2", exerciseId: "e2", date: "2026-07-04", weight: 150, reps: 5 }),
      setRow({ sessionId: "s2", exerciseId: "e2", date: "2026-07-04", weight: 150, reps: 3 }),
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.bestSession).toEqual({ date: "2026-07-04", sets: 2 });
    expect(agg.sparkSets).toEqual([1, 0, 0, 0, 0, 2, 0]);
  });

  it("yeni hareketler: history'de olmayanlar, ilk görülme sırasıyla, tekrarsız", () => {
    const rows = emptyRows();
    rows.sets = [
      setRow({ sessionId: "s1", exerciseId: "e2", exerciseName: "Squat", date: "2026-06-30" }),
      setRow({ sessionId: "s1", exerciseId: "e1", exerciseName: "Bench", date: "2026-06-30" }),
      setRow({ sessionId: "s2", exerciseId: "e2", exerciseName: "Squat", date: "2026-07-02" }),
    ];
    rows.historyExerciseIds = new Set(["e1"]);
    expect(aggregatePeriod(WEEK, rows).newExercises).toEqual(["Squat"]);
  });
});

describe("aggregatePeriod — PR (koç motoruyla aynı frontier)", () => {
  it("dönem öncesi 100kg varken dönemdeki 95kg PR DEĞİL; 105kg PR'dır ve bestPr odur", () => {
    const rows = emptyRows();
    rows.prHistorySets = [
      { exerciseId: "e1", exerciseName: "Bench", region: "Göğüs", date: "2026-05-01", weight: 100, reps: 5, rir: null },
      { exerciseId: "e1", exerciseName: "Bench", region: "Göğüs", date: "2026-06-30", weight: 95, reps: 5, rir: null },
      { exerciseId: "e1", exerciseName: "Bench", region: "Göğüs", date: "2026-07-02", weight: 105, reps: 5, rir: null },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.prCount).toBe(1);
    expect(agg.bestPr).toEqual({ exercise: "Bench", weight: 105, reps: 5 });
  });

  it("PR'lar bölgeye göre gruplanır; bölgesiz egzersiz 'Diğer'e düşer", () => {
    const rows = emptyRows();
    rows.prHistorySets = [
      { exerciseId: "e1", exerciseName: "Bench", region: "Üst Göğüs", date: "2026-05-01", weight: 100, reps: 5, rir: null },
      { exerciseId: "e1", exerciseName: "Bench", region: "Üst Göğüs", date: "2026-06-30", weight: 102, reps: 5, rir: null },
      { exerciseId: "e1", exerciseName: "Bench", region: "Üst Göğüs", date: "2026-07-02", weight: 104, reps: 5, rir: null },
      { exerciseId: "e9", exerciseName: "Farmer Walk", region: null, date: "2026-05-10", weight: 40, reps: 20, rir: null },
      { exerciseId: "e9", exerciseName: "Farmer Walk", region: null, date: "2026-07-01", weight: 45, reps: 20, rir: null },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.prCount).toBe(3);
    expect(agg.prRegions).toEqual([
      { region: "Üst Göğüs", count: 2 },
      { region: "Diğer", count: 1 },
    ]);
  });

  it("ilk kayıt baseline'dır, PR değil", () => {
    const rows = emptyRows();
    rows.prHistorySets = [
      { exerciseId: "e3", exerciseName: "Deadlift", region: "Sırt", date: "2026-07-02", weight: 180, reps: 1, rir: null },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.prCount).toBe(0);
    expect(agg.prRegions).toEqual([]);
  });
});

describe("aggregatePeriod — takip metrikleri", () => {
  it("tüm sayısal metriklerin ortalaması metricAvgs'e girer; loglanmayan girmez", () => {
    const rows = emptyRows();
    rows.metricDays = [
      metricDay({ date: "2026-06-29", weight: 80, sleepHours: 7, restingHr: 55, energy: 7, steps: 8000, waterMl: 2500 }),
      metricDay({ date: "2026-06-30", weight: 80.4, sleepHours: 8, restingHr: 53, energy: 9, steps: 12000, waterMl: 3500 }),
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.metricAvgs.weight).toBeCloseTo(80.2, 5);
    expect(agg.metricAvgs.sleep_hours).toBeCloseTo(7.5, 5);
    expect(agg.metricAvgs.resting_hr).toBe(54);
    expect(agg.metricAvgs.energy).toBe(8);
    expect(agg.metricAvgs.steps).toBe(10000);
    expect(agg.metricAvgs.hunger).toBeUndefined();
    expect(agg.metricAvgs.adherence).toBeUndefined();
    expect(agg.waterAvgMl).toBe(3000);
  });

  it("su hedef günleri: hedef varsa ulaşılan gün sayısı", () => {
    const rows = emptyRows();
    rows.target = { kcal: null, protein: null, carbs: null, fat: null, waterMl: 3000 };
    rows.metricDays = [
      metricDay({ date: "2026-06-29", waterMl: 3200 }),
      metricDay({ date: "2026-06-30", waterMl: 2400 }),
      metricDay({ date: "2026-07-01", waterMl: 3000 }),
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.waterDaysLogged).toBe(3);
    expect(agg.waterGoalDays).toBe(2);
  });

  it("tartım çıpaları: ilk/son 3 ortalaması; hiç tartım yoksa null", () => {
    const rows = emptyRows();
    rows.metricDays = [
      metricDay({ date: "2026-06-29", weight: 80.0 }),
      metricDay({ date: "2026-06-30", weight: 80.4 }),
      metricDay({ date: "2026-07-02", weight: 79.8 }),
      metricDay({ date: "2026-07-04", weight: 79.2 }),
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.weightFirst).toBeCloseTo((80.0 + 80.4 + 79.8) / 3, 5);
    expect(agg.weightLast).toBeCloseTo((79.8 + 79.2 + 80.4) / 3, 5);
    expect(agg.weightSamples).toBe(4);
    expect(aggregatePeriod(WEEK, emptyRows()).weightFirst).toBeNull();
  });
});

describe("aggregatePeriod — beslenme", () => {
  it("ortalama kcal/makrolar loglu günlerden; bant içi/üstü/altı günler sayılır", () => {
    const rows = emptyRows();
    rows.target = { kcal: 2000, protein: 150, carbs: 220, fat: 60, waterMl: null };
    rows.mealDays = [
      { date: "2026-06-29", kcal: 2050, protein: 140, carbs: 210, fat: 55 }, // bantta
      { date: "2026-06-30", kcal: 2600, protein: 100, carbs: 300, fat: 90 }, // üstünde
      { date: "2026-07-01", kcal: 1500, protein: 200, carbs: 120, fat: 40 }, // altında
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.nutritionDaysLogged).toBe(3);
    expect(agg.kcalAvg).toBe(Math.round((2050 + 2600 + 1500) / 3));
    expect(agg.kcalDaysInBand).toBe(1);
    expect(agg.kcalDaysOver).toBe(1);
    expect(agg.kcalDaysUnder).toBe(1);
    expect(agg.proteinAvg).toBe(Math.round((140 + 100 + 200) / 3));
    expect(agg.carbsAvg).toBe(210);
    expect(agg.fatAvg).toBe(Math.round((55 + 90 + 40) / 3));
    expect(agg.proteinDaysHit).toBe(2); // 140>=135, 200>=135
  });

  it("hedef yoksa bant sayaçları 0 kalır ama ortalamalar hesaplanır", () => {
    const rows = emptyRows();
    rows.mealDays = [{ date: "2026-06-29", kcal: 2000, protein: 150, carbs: 200, fat: 60 }];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.kcalAvg).toBe(2000);
    expect(agg.kcalDaysInBand).toBe(0);
    expect(agg.kcalDaysOver).toBe(0);
    expect(agg.kcalDaysUnder).toBe(0);
  });
});

describe("aggregatePeriod — spark bucket tipleri", () => {
  it("monthly: ISO hafta bucket'ları; milestone: ay bucket'ları", () => {
    const monthly: Period = { type: "monthly", start: "2026-06-01", end: "2026-06-30" };
    const rows = emptyRows();
    rows.sets = [
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-06-02" }),
      setRow({ sessionId: "s2", exerciseId: "e1", date: "2026-06-29" }),
    ];
    expect(aggregatePeriod(monthly, rows).sparkSets).toEqual([1, 0, 0, 0, 1]);

    const milestone: Period = { type: "milestone", start: "2026-01-10", end: "2026-04-10", months: 3 };
    const rows2 = emptyRows();
    rows2.sets = [
      setRow({ sessionId: "s1", exerciseId: "e1", date: "2026-01-15" }),
      setRow({ sessionId: "s2", exerciseId: "e1", date: "2026-04-05" }),
    ];
    expect(aggregatePeriod(milestone, rows2).sparkSets).toEqual([1, 0, 0, 1]);
  });

  it("daysInPeriod hesaplanır", () => {
    expect(aggregatePeriod(WEEK, emptyRows()).daysInPeriod).toBe(7);
  });
});
