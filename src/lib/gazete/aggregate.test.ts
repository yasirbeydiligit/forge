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

describe("aggregatePeriod — antrenman", () => {
  it("set/seans/tonaj sayar; weight'i null set tonaja girmez ama set sayısına girer", () => {
    const rows = emptyRows();
    rows.sessions = [
      { id: "s1", date: "2026-06-29", completed: true },
      { id: "s2", date: "2026-07-01", completed: true },
    ];
    rows.sets = [
      { sessionId: "s1", exerciseId: "e1", exerciseName: "Bench", date: "2026-06-29", weight: 100, reps: 5, rir: 2 },
      { sessionId: "s1", exerciseId: "e1", exerciseName: "Bench", date: "2026-06-29", weight: null, reps: 12, rir: null },
      { sessionId: "s2", exerciseId: "e2", exerciseName: "Squat", date: "2026-07-01", weight: 120, reps: 3, rir: 1 },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.sessionsCompleted).toBe(2);
    expect(agg.totalSets).toBe(3);
    expect(agg.tonnageKg).toBe(100 * 5 + 120 * 3);
  });

  it("bestSession tonaja göre; spark 7 günlük bucket, boş günler 0", () => {
    const rows = emptyRows();
    rows.sessions = [
      { id: "s1", date: "2026-06-29", completed: true },
      { id: "s2", date: "2026-07-04", completed: true },
    ];
    rows.sets = [
      { sessionId: "s1", exerciseId: "e1", exerciseName: "Bench", date: "2026-06-29", weight: 100, reps: 5, rir: null },
      { sessionId: "s2", exerciseId: "e2", exerciseName: "Squat", date: "2026-07-04", weight: 150, reps: 5, rir: null },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.bestSession).toEqual({ date: "2026-07-04", sets: 1, tonnageKg: 750 });
    expect(agg.sparkTonnage).toEqual([500, 0, 0, 0, 0, 750, 0]);
  });

  it("yeni hareketler: history'de olmayanlar, ilk görülme sırasıyla, tekrarsız", () => {
    const rows = emptyRows();
    rows.sets = [
      { sessionId: "s1", exerciseId: "e2", exerciseName: "Squat", date: "2026-06-30", weight: 60, reps: 8, rir: null },
      { sessionId: "s1", exerciseId: "e1", exerciseName: "Bench", date: "2026-06-30", weight: 60, reps: 8, rir: null },
      { sessionId: "s2", exerciseId: "e2", exerciseName: "Squat", date: "2026-07-02", weight: 70, reps: 8, rir: null },
    ];
    rows.historyExerciseIds = new Set(["e1"]);
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.newExercises).toEqual(["Squat"]);
  });
});

describe("aggregatePeriod — PR (koç motoruyla aynı frontier)", () => {
  it("dönem öncesi 100kg varken dönemdeki 95kg PR DEĞİL; 105kg PR'dır ve bestPr odur", () => {
    const rows = emptyRows();
    rows.prHistorySets = [
      { exerciseId: "e1", exerciseName: "Bench", date: "2026-05-01", weight: 100, reps: 5, rir: null },
      { exerciseId: "e1", exerciseName: "Bench", date: "2026-06-30", weight: 95, reps: 5, rir: null },
      { exerciseId: "e1", exerciseName: "Bench", date: "2026-07-02", weight: 105, reps: 5, rir: null },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.prCount).toBe(1);
    expect(agg.bestPr).toEqual({ exercise: "Bench", weight: 105, reps: 5 });
  });

  it("ilk kayıt baseline'dır, PR değil; farklı egzersizlerin gerçek PR'ları toplanır", () => {
    const rows = emptyRows();
    rows.prHistorySets = [
      // e1: geçmişte 100 → dönemde 102 = PR
      { exerciseId: "e1", exerciseName: "Bench", date: "2026-05-01", weight: 100, reps: 5, rir: null },
      { exerciseId: "e1", exerciseName: "Bench", date: "2026-06-29", weight: 102, reps: 5, rir: null },
      // e2: geçmişte 130 → dönemde 140 = PR
      { exerciseId: "e2", exerciseName: "Squat", date: "2026-05-10", weight: 130, reps: 3, rir: null },
      { exerciseId: "e2", exerciseName: "Squat", date: "2026-07-01", weight: 140, reps: 3, rir: null },
      // e3: dönem içi İLK kayıt — baseline, PR sayılmaz (motor davranışı)
      { exerciseId: "e3", exerciseName: "Deadlift", date: "2026-07-02", weight: 180, reps: 1, rir: null },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.prCount).toBe(2);
    expect(agg.bestPr?.exercise).toBe("Squat");
  });
});

describe("aggregatePeriod — metrikler & beslenme", () => {
  it("tartım çıpaları: ilk/son 3 ortalaması; 3'ten azsa eldekiler", () => {
    const rows = emptyRows();
    rows.metricDays = [
      { date: "2026-06-29", weight: 80.0, sleepHours: 7, steps: 8000 },
      { date: "2026-06-30", weight: 80.4, sleepHours: 8, steps: null },
      { date: "2026-07-02", weight: 79.8, sleepHours: null, steps: 12000 },
      { date: "2026-07-04", weight: 79.2, sleepHours: 6.5, steps: 10000 },
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.weightFirst).toBeCloseTo((80.0 + 80.4 + 79.8) / 3, 5);
    expect(agg.weightLast).toBeCloseTo((79.8 + 79.2 + 80.4) / 3, 5);
    expect(agg.weightSamples).toBe(4);
    expect(agg.sleepAvg).toBeCloseTo((7 + 8 + 6.5) / 3, 5);
    expect(agg.stepsAvg).toBe(10000);
  });

  it("hiç tartım yoksa çıpalar null", () => {
    const agg = aggregatePeriod(WEEK, emptyRows());
    expect(agg.weightFirst).toBeNull();
    expect(agg.weightLast).toBeNull();
    expect(agg.sleepAvg).toBeNull();
    expect(agg.stepsAvg).toBeNull();
  });

  it("protein/kcal günleri nutrition-weekly bantlarıyla sayılır", () => {
    const rows = emptyRows();
    rows.target = { kcal: 2000, protein: 150 };
    rows.mealDays = [
      { date: "2026-06-29", kcal: 2050, protein: 140 }, // kcal bantta, protein 140>=135 hit
      { date: "2026-06-30", kcal: 2600, protein: 100 }, // ikisi de değil
      { date: "2026-07-01", kcal: 1800, protein: 200 }, // kcal bantta (0.9), protein hit
    ];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.nutritionDaysLogged).toBe(3);
    expect(agg.proteinDaysHit).toBe(2);
    expect(agg.kcalDaysInBand).toBe(2);
  });

  it("target.protein null ise proteinDaysHit 0 kalır ama loglu günler sayılır", () => {
    const rows = emptyRows();
    rows.target = { kcal: null, protein: null };
    rows.mealDays = [{ date: "2026-06-29", kcal: 2000, protein: 150 }];
    const agg = aggregatePeriod(WEEK, rows);
    expect(agg.proteinDaysHit).toBe(0);
    expect(agg.kcalDaysInBand).toBe(0);
    expect(agg.nutritionDaysLogged).toBe(1);
  });
});

describe("aggregatePeriod — spark bucket tipleri", () => {
  it("monthly: ISO hafta bucket'ları", () => {
    const period: Period = { type: "monthly", start: "2026-06-01", end: "2026-06-30" };
    const rows = emptyRows();
    rows.sets = [
      { sessionId: "s1", exerciseId: "e1", exerciseName: "B", date: "2026-06-02", weight: 100, reps: 5, rir: null },
      { sessionId: "s2", exerciseId: "e1", exerciseName: "B", date: "2026-06-29", weight: 100, reps: 5, rir: null },
    ];
    const agg = aggregatePeriod(period, rows);
    // Haziran 2026: 1 Haz Pzt → 5 tam ISO haftası (1, 8, 15, 22, 29 Haz)
    expect(agg.sparkTonnage).toHaveLength(5);
    expect(agg.sparkTonnage[0]).toBe(500);
    expect(agg.sparkTonnage[4]).toBe(500);
  });

  it("milestone: ay bucket'ları", () => {
    const period: Period = { type: "milestone", start: "2026-01-10", end: "2026-04-10", months: 3 };
    const rows = emptyRows();
    rows.sets = [
      { sessionId: "s1", exerciseId: "e1", exerciseName: "B", date: "2026-01-15", weight: 100, reps: 5, rir: null },
      { sessionId: "s2", exerciseId: "e1", exerciseName: "B", date: "2026-04-05", weight: 120, reps: 5, rir: null },
    ];
    const agg = aggregatePeriod(period, rows);
    // Oca, Şub, Mar, Nis → 4 bucket
    expect(agg.sparkTonnage).toEqual([500, 0, 0, 600]);
  });

  it("daysInPeriod hesaplanır", () => {
    expect(aggregatePeriod(WEEK, emptyRows()).daysInPeriod).toBe(7);
  });
});
