import { describe, expect, it } from "vitest";

import type { PeriodAggregates } from "./aggregate";
import type { TrainingGoal } from "./facts";
import { buildIssue, type BuildIssueContext } from "./build-issue";

function agg(overrides: Partial<PeriodAggregates> = {}): PeriodAggregates {
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
    sparkTonnage: [0, 0, 0, 0, 0, 0, 0],
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
      sessionsCompleted: 4,
      totalSets: 62,
      tonnageKg: 12400,
      prCount: 3,
      bestPr: { exercise: "Bench Press", weight: 105, reps: 5 },
      newExercises: ["Pendlay Row"],
      bestSession: { date: "2026-07-02", sets: 22, tonnageKg: 5100 },
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
      sparkTonnage: [3000, 0, 5100, 0, 4300, 0, 0],
    }),
    previous: agg({
      tonnageKg: 10000,
      sleepAvg: 7.1,
      totalSets: 50,
      sessionsCompleted: 3,
    }),
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
      current: agg({ sessionsCompleted: 1, totalSets: 8, tonnageKg: 1200 }),
      previous: null,
    });
    expect(payload).not.toBeNull();
    expect(payload!.headline.factType).toBe("neutral");
    expect(payload!.stories).toHaveLength(0);
    expect(payload!.statTable.length).toBeGreaterThan(0);
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
    expect(payload.lead.spark).toEqual([3000, 0, 5100, 0, 4300, 0, 0]);
    expect(payload.lead.stat).not.toBeNull();
  });

  it("statTable verisi olan satırları içerir, delta previous'a göre", () => {
    const payload = buildIssue(ctx, richInput())!;
    const labels = payload.statTable.map((r) => r.label);
    expect(labels).toContain("Toplam set");
    const sets = payload.statTable.find((r) => r.label === "Toplam set")!;
    expect(sets.value).toBe("62");
    expect(sets.delta).toBe("up"); // 62 > 50
  });

  it("kardiyo 0 ise satırı yok", () => {
    const input = richInput();
    input.current.cardioMinutes = 0;
    input.current.cardioCount = 0;
    input.current.cardioDistanceKm = 0;
    const payload = buildIssue(ctx, input)!;
    expect(payload.statTable.map((r) => r.label)).not.toContain("Kardiyo");
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
    expect(other.v).toBe(1);
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
