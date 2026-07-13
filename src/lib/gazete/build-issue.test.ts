import { describe, expect, it } from "vitest";

import type { PeriodAggregates } from "./aggregate";
import type { TrainingGoal } from "./facts";
import { buildIssue, type BuildIssueContext } from "./build-issue";

function agg(overrides: Partial<PeriodAggregates> = {}): PeriodAggregates {
  return {
    daysInPeriod: 7,
    sessionsTrained: 0,
    totalSets: 0,
    prCount: 0,
    bestPr: null,
    newExercises: [],
    bestSession: null,
    weightFirst: null,
    weightLast: null,
    weightSamples: 0,
    sleepAvg: null,
    stepsAvg: null,
    proteinDaysHit: 0,
    nutritionDaysLogged: 0,
    kcalDaysInBand: 0,
    cardioMinutes: 0,
    cardioDistanceKm: 0,
    cardioCount: 0,
    protocolDone: 0,
    protocolDue: 0,
    weeklyTargetDays: null,
    sparkSets: [0, 0, 0, 0, 0, 0, 0],
    setsPerSession: null,
    avgRir: null,
    prRegions: [],
    muscleSets: [],
    regionSets: [],
    metricAvgs: {},
    waterAvgMl: null,
    waterDaysLogged: 0,
    waterGoalDays: 0,
    kcalAvg: null,
    proteinAvg: null,
    carbsAvg: null,
    fatAvg: null,
    kcalDaysOver: 0,
    kcalDaysUnder: 0,
    targetKcal: null,
    targetProtein: null,
    targetWaterMl: null,
    ...overrides,
  };
}

const ctx: BuildIssueContext = {
  seed: "ath1:weekly:2026-07-05",
  periodType: "weekly",
  photos: null,
  nextMilestone: { months: 3, dueDate: "2026-09-20" },
};

/** PR + tutarlılık + protein — zengin bir hafta. */
function richInput() {
  return {
    goal: "muscle_gain" as TrainingGoal,
    periodType: "weekly" as const,
    current: agg({
      sessionsTrained: 4,
      totalSets: 62,
      prCount: 3,
      bestPr: { exercise: "Bench Press", weight: 105, reps: 5 },
      newExercises: ["Pendlay Row"],
      bestSession: { date: "2026-07-02", sets: 22 },
      weightFirst: 71,
      weightLast: 72.2,
      weightSamples: 5,
      sleepAvg: 7.6,
      stepsAvg: 9500,
      proteinDaysHit: 6,
      nutritionDaysLogged: 7,
      kcalDaysInBand: 5,
      cardioMinutes: 95,
      cardioDistanceKm: 12.4,
      cardioCount: 3,
      protocolDone: 13,
      protocolDue: 14,
      weeklyTargetDays: 4,
      sparkSets: [8, 0, 22, 0, 15, 0, 0],
      setsPerSession: 15.5,
      avgRir: 2.1,
      prRegions: [
        { region: "Üst Göğüs", count: 2 },
        { region: "Sırt Orta", count: 1 },
      ],
      muscleSets: [
        { muscle: "Göğüs", sets: 18 },
        { muscle: "Kanat", sets: 14 },
        { muscle: "Quadriceps", sets: 12 },
      ],
      regionSets: [
        { region: "Üst Göğüs", sets: 12 },
        { region: "Sırt Orta", sets: 10 },
      ],
      metricAvgs: { weight: 71.6, sleep_hours: 7.6, energy: 8, steps: 9500 },
      waterAvgMl: 2800,
      waterDaysLogged: 6,
      waterGoalDays: 4,
      kcalAvg: 2450,
      proteinAvg: 158,
      carbsAvg: 260,
      fatAvg: 78,
      kcalDaysOver: 1,
      kcalDaysUnder: 1,
      targetKcal: 2500,
      targetProtein: 150,
      targetWaterMl: 3000,
    }),
    previous: agg({
      sleepAvg: 7.1,
      totalSets: 50,
      sessionsTrained: 3,
      metricAvgs: { weight: 71.0, sleep_hours: 7.1, energy: 8.1, steps: 8000 },
    }) as PeriodAggregates | null,
  };
}

describe("buildIssue — boş dönem", () => {
  it("hiç veri yoksa null döner (sayı basılmaz)", () => {
    const payload = buildIssue(ctx, {
      goal: null,
      periodType: "weekly",
      current: agg(),
      previous: null,
    });
    expect(payload).toBeNull();
  });

  it("pozitif fact yok ama veri var → nötr manşet + dolu statTable, stories boş", () => {
    const payload = buildIssue(ctx, {
      goal: null,
      periodType: "weekly",
      current: agg({ sessionsTrained: 1, totalSets: 8 }),
      previous: null,
    });
    expect(payload).not.toBeNull();
    expect(payload!.headline.factType).toBe("neutral");
    expect(payload!.stories).toHaveLength(0);
    expect(payload!.sections.antrenman?.totalSets).toBe(8);
  });
});

describe("buildIssue — zengin dönem", () => {
  it("en yüksek skorlu fact manşettir ve stories'te tekrarlanmaz; stories ≤ 5", () => {
    const payload = buildIssue(ctx, richInput())!;
    expect(payload.headline.factType).toBe("pr_count"); // en yüksek taban skor
    expect(payload.stories.length).toBeLessThanOrEqual(5);
    expect(payload.stories.map((s) => s.factType)).not.toContain("pr_count");
  });

  it("lead manşet fact'inin gövdesini ve spark'ı taşır", () => {
    const payload = buildIssue(ctx, richInput())!;
    expect(payload.lead.body.length).toBeGreaterThan(10);
    expect(payload.lead.spark).toEqual([8, 0, 22, 0, 15, 0, 0]);
    expect(payload.lead.stat).not.toBeNull();
  });

  it("ANTRENMAN bölümü: totaller, kapak kası, kas/bölge tabloları, PR bölgeleri", () => {
    const a = buildIssue(ctx, richInput())!.sections.antrenman!;
    expect(a.sessions).toBe(4);
    expect(a.totalSets).toBe(62);
    expect(a.setsPerSession).toBe(15.5);
    expect(a.avgRir).toBe(2.1);
    expect(a.prTotal).toBe(3);
    expect(a.topMuscle).toEqual({ muscle: "Göğüs", sets: 18 });
    expect(a.muscleSets[0]).toEqual({ muscle: "Göğüs", sets: 18 });
    expect(a.regionSets).toHaveLength(2);
    expect(a.prRegions[0]).toEqual({ region: "Üst Göğüs", count: 2 });
  });

  it("kas tablosunun uzun kuyruğu 'Diğer' satırına katlanır", () => {
    const input = richInput();
    input.current.muscleSets = Array.from({ length: 12 }, (_, i) => ({
      muscle: `Kas${i}`,
      sets: 12 - i,
    }));
    const a = buildIssue(ctx, input)!.sections.antrenman!;
    expect(a.muscleSets).toHaveLength(8);
    expect(a.muscleSets[7].muscle).toBe("Diğer");
    expect(a.muscleSets[7].sets).toBe(5 + 4 + 3 + 2 + 1); // katlanan 5 satırın toplamı
  });

  it("BESLENME bölümü: kcal ortalama/hedef/bant günleri + makrolar + protokol", () => {
    const b = buildIssue(ctx, richInput())!.sections.beslenme!;
    expect(b.kcal).toEqual({ avg: 2450, target: 2500, inBand: 5, over: 1, under: 1 });
    expect(b.macros).toEqual({ proteinAvg: 158, carbsAvg: 260, fatAvg: 78, proteinTarget: 150 });
    expect(b.protocol).toEqual({ done: 13, due: 14 });
  });

  it("TAKİP bölümü: metrik ortalamaları + trend + polarite; su ve kardiyo", () => {
    const t = buildIssue(ctx, richInput())!.sections.takip!;
    const byKey = Object.fromEntries(t.metrics.map((m) => [m.key, m]));
    // muscle_gain hedefi: kilo artışı iyidir
    expect(byKey.weight.trend).toBe("up");
    expect(byKey.weight.better).toBe(true);
    // uyku yükseldi → iyi
    expect(byKey.sleep_hours.trend).toBe("up");
    expect(byKey.sleep_hours.better).toBe(true);
    // enerji 8 vs 8.1 → epsilon içinde flat
    expect(byKey.energy.trend).toBe("flat");
    expect(byKey.energy.better).toBeNull();
    expect(byKey.steps.trend).toBe("up");
    expect(t.water).toEqual({ avgMl: 2800, goalMl: 3000, goalDays: 4, daysLogged: 6 });
    expect(t.cardio).toEqual({ count: 3, minutes: 95, distanceKm: 12.4 });
  });

  it("previous yokken trendler null; veri yoksa bölüm null", () => {
    const input = richInput();
    input.previous = null;
    const t = buildIssue(ctx, input)!.sections.takip!;
    expect(t.metrics.every((m) => m.trend === null)).toBe(true);

    const empty = buildIssue(ctx, {
      goal: null,
      periodType: "weekly",
      current: agg({ sessionsTrained: 1, totalSets: 8 }),
      previous: null,
    })!;
    expect(empty.sections.beslenme).toBeNull();
    expect(empty.sections.takip).toBeNull();
    expect(empty.sections.antrenman).not.toBeNull();
  });

  it("kardiyo 0 ise takip.cardio null", () => {
    const input = richInput();
    input.current.cardioMinutes = 0;
    input.current.cardioCount = 0;
    input.current.cardioDistanceKm = 0;
    const payload = buildIssue(ctx, input)!;
    expect(payload.sections.takip!.cardio).toBeNull();
  });

  it("editorNotes en fazla 2, şiddet sırasına göre", () => {
    const input = richInput();
    input.goal = "fat_loss"; // kilo artışı artık aleyhte → caution
    input.current.sleepAvg = 6.0;
    input.previous!.sleepAvg = 7.2; // uyku gerilemesi → caution
    input.current.proteinDaysHit = 2; // protein düşük → caution (3 aday)
    const payload = buildIssue(ctx, input)!;
    expect(payload.editorNotes.length).toBeLessThanOrEqual(2);
    expect(payload.editorNotes.length).toBeGreaterThan(0);
  });

  it("determinizm: aynı girdi + aynı seed → birebir aynı payload", () => {
    const a = buildIssue(ctx, richInput());
    const b = buildIssue(ctx, richInput());
    expect(a).toEqual(b);
  });

  it("farklı seed farklı sayı kimliği üretebilir ama yapı geçerli kalır", () => {
    const other = buildIssue({ ...ctx, seed: "ath1:weekly:2026-07-12" }, richInput())!;
    expect(other.v).toBe(2);
    expect(typeof other.headline.title).toBe("string");
  });

  it("fotoğraflar ctx'ten geçer; kapanış nextMilestone taşır", () => {
    const photos = {
      beforeId: "p1",
      afterId: "p2",
      beforeDate: "2026-06-29",
      afterDate: "2026-07-05",
      beforeWeightKg: 72,
      afterWeightKg: 71.2,
    };
    const payload = buildIssue({ ...ctx, photos }, richInput())!;
    expect(payload.photos).toEqual(photos);
    expect(payload.closing.nextMilestoneMonths).toBe(3);
    expect(payload.closing.nextMilestoneDate).toBe("2026-09-20");
  });
});
