import { describe, expect, it } from "vitest";

import type { PeriodAggregates } from "./aggregate";
import {
  CONSISTENCY_PRAISE_RATIO,
  extractFacts,
  PROTEIN_PRAISE_RATIO,
  SLEEP_IMPROVE_MIN_H,
  WEIGHT_MIN_SAMPLES,
  WEIGHT_TREND_MIN_KG,
} from "./facts";

function baseAgg(overrides: Partial<PeriodAggregates> = {}): PeriodAggregates {
  return {
    daysInPeriod: 7,
    sessionsCompleted: 0,
    totalSets: 0,
    tonnageKg: 0,
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
    sparkTonnage: [],
    ...overrides,
  };
}

function input(
  current: Partial<PeriodAggregates>,
  opts: {
    goal?: "muscle_gain" | "strength" | "fat_loss" | "maintenance" | null;
    previous?: Partial<PeriodAggregates> | null;
    periodType?: "weekly" | "monthly" | "milestone";
  } = {},
) {
  return {
    goal: opts.goal ?? null,
    periodType: opts.periodType ?? ("weekly" as const),
    current: baseAgg(current),
    previous: opts.previous === undefined ? null : opts.previous && baseAgg(opts.previous),
  };
}

// Yeterli örneklemli, eşiği aşan kilo düşüşü/artışı fikstürleri.
const weightDown = {
  weightFirst: 81.0,
  weightLast: 79.8,
  weightSamples: WEIGHT_MIN_SAMPLES,
};
const weightUp = {
  weightFirst: 71.0,
  weightLast: 72.2,
  weightSamples: WEIGHT_MIN_SAMPLES,
};

describe("dürüstlük garantileri", () => {
  it("fat_loss hedefinde kilo ARTIŞI asla positive fact olmaz; caution olur", () => {
    const { facts, cautions } = extractFacts(input(weightUp, { goal: "fat_loss" }));
    expect(facts.find((f) => f.type === "weight_trend")).toBeUndefined();
    expect(cautions.some((c) => c.type === "weight_against_goal")).toBe(true);
  });

  it("muscle_gain hedefinde aynı kilo artışı övgüdür", () => {
    const { facts, cautions } = extractFacts(input(weightUp, { goal: "muscle_gain" }));
    const f = facts.find((f) => f.type === "weight_trend");
    expect(f?.direction).toBe("positive");
    expect(f?.slots.deltaKg).toBe(1.2);
    expect(f?.slots.direction).toBe("aldın");
    expect(cautions).toHaveLength(0);
  });

  it("fat_loss hedefinde kilo düşüşü övgüdür", () => {
    const { facts } = extractFacts(input(weightDown, { goal: "fat_loss" }));
    const f = facts.find((f) => f.type === "weight_trend");
    expect(f?.direction).toBe("positive");
    expect(f?.slots.direction).toBe("verdin");
  });

  it("goal null iken kilo değişimi nötr fact'tir (övgü yönü yok)", () => {
    const { facts, cautions } = extractFacts(input(weightDown, { goal: null }));
    const f = facts.find((f) => f.type === "weight_trend");
    expect(f?.direction).toBe("neutral");
    expect(cautions).toHaveLength(0);
  });

  it("örneklem yetersizse kilo trendi hiç üretilmez", () => {
    const { facts, cautions } = extractFacts(
      input(
        { ...weightDown, weightSamples: WEIGHT_MIN_SAMPLES - 1 },
        { goal: "fat_loss" },
      ),
    );
    expect(facts.find((f) => f.type === "weight_trend")).toBeUndefined();
    expect(cautions).toHaveLength(0);
  });

  it("eşik altı değişim (WEIGHT_TREND_MIN_KG) gürültüdür, fact olmaz", () => {
    const { facts } = extractFacts(
      input(
        {
          weightFirst: 80,
          weightLast: 80 + WEIGHT_TREND_MIN_KG - 0.1,
          weightSamples: WEIGHT_MIN_SAMPLES,
        },
        { goal: "muscle_gain" },
      ),
    );
    expect(facts.find((f) => f.type === "weight_trend")).toBeUndefined();
  });

  it("maintenance: stabil kilo övgü, bandın dışı caution", () => {
    const stable = extractFacts(
      input(
        { weightFirst: 80, weightLast: 80.2, weightSamples: 6 },
        { goal: "maintenance" },
      ),
    );
    expect(stable.facts.find((f) => f.type === "weight_trend")?.direction).toBe(
      "positive",
    );
    const drifted = extractFacts(
      input(
        { weightFirst: 80, weightLast: 82.5, weightSamples: 6 },
        { goal: "maintenance" },
      ),
    );
    expect(drifted.facts.find((f) => f.type === "weight_trend")).toBeUndefined();
    expect(
      drifted.cautions.some((c) => c.type === "weight_against_goal"),
    ).toBe(true);
  });

  it("%79 tutarlılık övgü değil; %80 övgü (eşik CONSISTENCY_PRAISE_RATIO)", () => {
    // Hedef 5 gün/hafta → 7 günlük dönemde hedef 5 seans.
    const below = extractFacts(
      input({ sessionsCompleted: 3, weeklyTargetDays: 5, totalSets: 30 }),
    );
    expect(below.facts.find((f) => f.type === "consistency")).toBeUndefined();
    const at = extractFacts(
      input({ sessionsCompleted: 4, weeklyTargetDays: 5, totalSets: 30 }),
    );
    expect(at.facts.find((f) => f.type === "consistency")).toBeDefined();
    expect(4 / 5).toBeGreaterThanOrEqual(CONSISTENCY_PRAISE_RATIO);
  });

  it("previous yoksa volume_trend üretilmez (uydurma kıyas yok)", () => {
    const { facts } = extractFacts(input({ totalSets: 40, tonnageKg: 10000 }));
    expect(facts.find((f) => f.type === "volume_trend")).toBeUndefined();
  });

  it("protein: loglu gün az ise (NUTRITION_MIN_LOGGED_DAYS altı) fact yok", () => {
    const { facts } = extractFacts(
      input({ proteinDaysHit: 3, nutritionDaysLogged: 3 }),
    );
    expect(facts.find((f) => f.type === "protein_consistency")).toBeUndefined();
  });
});

describe("pozitif fact üretimi", () => {
  it("PR fact'i slotlarıyla üretilir; skor sayıyla artar", () => {
    const one = extractFacts(
      input({ prCount: 1, bestPr: { exercise: "Bench", weight: 100, reps: 5 } }),
    );
    const five = extractFacts(
      input({ prCount: 5, bestPr: { exercise: "Bench", weight: 100, reps: 5 } }),
    );
    const f1 = one.facts.find((f) => f.type === "pr_count")!;
    const f5 = five.facts.find((f) => f.type === "pr_count")!;
    expect(f1.slots.count).toBe(1);
    expect(f1.slots.exercise).toBe("Bench");
    expect(f5.score).toBeGreaterThan(f1.score);
  });

  it("volume_trend: önceki döneme +%10 üstü artış övgü", () => {
    const { facts } = extractFacts(
      input(
        { totalSets: 44, tonnageKg: 11000 },
        { previous: { totalSets: 40, tonnageKg: 9500 } },
      ),
    );
    const f = facts.find((f) => f.type === "volume_trend");
    expect(f).toBeDefined();
    expect(f?.slots.percent).toBe(16); // 11000/9500 → %15.8 → yuvarlanır
  });

  it("uyku iyileşmesi previous'a göre; eşik altı üretilmez", () => {
    const good = extractFacts(
      input({ sleepAvg: 7.5 }, { previous: { sleepAvg: 7.0 } }),
    );
    expect(good.facts.find((f) => f.type === "sleep_improvement")).toBeDefined();
    const noise = extractFacts(
      input(
        { sleepAvg: 7.0 + SLEEP_IMPROVE_MIN_H - 0.1 },
        { previous: { sleepAvg: 7.0 } },
      ),
    );
    expect(
      noise.facts.find((f) => f.type === "sleep_improvement"),
    ).toBeUndefined();
  });

  it("uyku gerilemesi caution üretir (0.5s üstü)", () => {
    const { cautions } = extractFacts(
      input({ sleepAvg: 6.4 }, { previous: { sleepAvg: 7.2 } }),
    );
    expect(cautions.some((c) => c.type === "sleep_decline")).toBe(true);
  });

  it("protein tutarlılığı: loglu günlerin %80'i", () => {
    const { facts } = extractFacts(
      input({ proteinDaysHit: 5, nutritionDaysLogged: 6 }),
    );
    const f = facts.find((f) => f.type === "protein_consistency");
    expect(f).toBeDefined();
    expect(5 / 6).toBeGreaterThanOrEqual(PROTEIN_PRAISE_RATIO);
  });

  it("kardiyo: haftalıkta 60dk altı fact yok, üstü var", () => {
    const low = extractFacts(input({ cardioMinutes: 45, cardioCount: 2 }));
    expect(low.facts.find((f) => f.type === "cardio_total")).toBeUndefined();
    const ok = extractFacts(input({ cardioMinutes: 90, cardioCount: 3 }));
    expect(ok.facts.find((f) => f.type === "cardio_total")).toBeDefined();
  });

  it("yeni hareketler ve en iyi seans fact olur", () => {
    const { facts } = extractFacts(
      input({
        newExercises: ["Bulgarian Split Squat"],
        bestSession: { date: "2026-07-02", sets: 24, tonnageKg: 9200 },
        totalSets: 60,
        sessionsCompleted: 4, // tek seanslı dönemde "en iyi seans" haber değildir
      }),
    );
    expect(facts.find((f) => f.type === "new_exercises")?.slots.first).toBe(
      "Bulgarian Split Squat",
    );
    expect(facts.find((f) => f.type === "best_session")).toBeDefined();
  });

  it("milestone'da weight_trend skoru haftalıktakinden yüksek (yıldız haber çarpanı)", () => {
    const weekly = extractFacts(input(weightDown, { goal: "fat_loss" }));
    const milestone = extractFacts(
      input(weightDown, { goal: "fat_loss", periodType: "milestone" }),
    );
    const ws = weekly.facts.find((f) => f.type === "weight_trend")!.score;
    const ms = milestone.facts.find((f) => f.type === "weight_trend")!.score;
    expect(ms).toBeGreaterThan(ws);
  });

  it("boş agregat hiç fact/caution üretmez", () => {
    const { facts, cautions } = extractFacts(input({}));
    expect(facts).toHaveLength(0);
    expect(cautions).toHaveLength(0);
  });
});
