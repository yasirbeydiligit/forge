import { describe, expect, it } from "vitest";

import { extractFacts } from "./facts";
import {
  EDITOR_NOTES,
  fillTemplate,
  HEADLINES,
  NEUTRAL_HEADLINES,
  pickVariant,
  STORY_BODIES,
  type Template,
} from "./copy";

describe("fillTemplate — zorunlu slot garantisi", () => {
  it("eksik slotta null döner — yarım cümle asla basılmaz", () => {
    expect(
      fillTemplate({ text: "{count} PR kırdın", slots: ["count"] }, {}),
    ).toBeNull();
  });

  it("tüm slotlar doluysa metni doldurur", () => {
    expect(
      fillTemplate(
        { text: "{exercise} için {weight} kg", slots: ["exercise", "weight"] },
        { exercise: "Bench", weight: 105 },
      ),
    ).toBe("Bench için 105 kg");
  });

  it("sayılar Türkçe biçimlenir: ondalık virgül, binlik nokta", () => {
    expect(
      fillTemplate({ text: "{deltaKg} kg {direction}", slots: ["deltaKg", "direction"] }, { deltaKg: 1.8, direction: "verdin" }),
    ).toBe("1,8 kg verdin");
    expect(
      fillTemplate({ text: "Günde {avg} adım", slots: ["avg"] }, { avg: 9412 }),
    ).toBe("Günde 9.412 adım");
  });

  it("slots listesinde olmayan placeholder da doldurulur ama zorunluluk listeden gelir", () => {
    // Şablon yazarı slots'u eksik bildirdiyse bile metindeki placeholder
    // doldurulamıyorsa null dönmeli (çift güvence).
    expect(
      fillTemplate({ text: "{a} ve {b}", slots: ["a"] }, { a: 1 }),
    ).toBeNull();
  });
});

describe("pickVariant — deterministik çeşitlilik", () => {
  const pool = HEADLINES.pr_count;

  it("aynı seed aynı varyantı seçer", () => {
    expect(pickVariant(pool, "ath1:weekly:2026-07-05")).toBe(
      pickVariant(pool, "ath1:weekly:2026-07-05"),
    );
  });

  it("seed'ler havuzu geziyor (20 seed'de en az 2 farklı varyant)", () => {
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => pickVariant(pool, `seed-${i}`)),
    );
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});

describe("havuz bütünlüğü — her fact tipi konuşabilmeli", () => {
  const factTypes = Object.keys(HEADLINES) as (keyof typeof HEADLINES)[];

  it("her FactType için en az 2 manşet ve 2 gövde varyantı var", () => {
    for (const t of factTypes) {
      expect(HEADLINES[t].length, `HEADLINES.${t}`).toBeGreaterThanOrEqual(2);
      expect(STORY_BODIES[t].length, `STORY_BODIES.${t}`).toBeGreaterThanOrEqual(2);
    }
    expect(NEUTRAL_HEADLINES.length).toBeGreaterThanOrEqual(2);
  });

  it("şablonlardaki placeholder'lar slots bildirimiyle tutarlı", () => {
    const check = (tpl: Template, where: string) => {
      const placeholders = [...tpl.text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const p of placeholders) {
        expect(tpl.slots, `${where}: "${tpl.text}" -> {${p}}`).toContain(p);
      }
    };
    for (const t of factTypes) {
      HEADLINES[t].forEach((tpl) => check(tpl, `HEADLINES.${t}`));
      STORY_BODIES[t].forEach((tpl) => check(tpl, `STORY_BODIES.${t}`));
    }
    (Object.keys(EDITOR_NOTES) as (keyof typeof EDITOR_NOTES)[]).forEach((t) =>
      EDITOR_NOTES[t].forEach((tpl) => check(tpl, `EDITOR_NOTES.${t}`)),
    );
    NEUTRAL_HEADLINES.forEach((tpl) => check(tpl, "NEUTRAL_HEADLINES"));
  });

  it("fact üreticisinin slot anahtarları şablonların zorunlu slotlarını karşılıyor", () => {
    // Temsili uçtan uca tutarlılık: gerçek extractFacts çıktısındaki slotlar
    // o tipin TÜM şablonlarını doldurabilmeli.
    const { facts } = extractFacts({
      goal: "muscle_gain",
      periodType: "weekly",
      current: {
        daysInPeriod: 7,
        sessionsCompleted: 4,
        totalSets: 60,
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
        cardioDistanceKm: 12,
        cardioCount: 3,
        protocolDone: 13,
        protocolDue: 14,
        weeklyTargetDays: 4,
        sparkSets: [0, 1, 2, 3, 4, 5, 6],
      },
      previous: {
        daysInPeriod: 7,
        sessionsCompleted: 3,
        totalSets: 50,
        prCount: 0,
        bestPr: null,
        newExercises: [],
        bestSession: null,
        weightFirst: 70.5,
        weightLast: 71,
        weightSamples: 4,
        sleepAvg: 7.1,
        stepsAvg: 8000,
        proteinDaysHit: 5,
        nutritionDaysLogged: 7,
        kcalDaysInBand: 4,
        cardioMinutes: 60,
        cardioDistanceKm: 8,
        cardioCount: 2,
        protocolDone: 12,
        protocolDue: 14,
        weeklyTargetDays: 4,
        sparkSets: [],
      },
    });
    expect(facts.length).toBeGreaterThanOrEqual(8);
    for (const fact of facts) {
      for (const tpl of [...HEADLINES[fact.type], ...STORY_BODIES[fact.type]]) {
        expect(
          fillTemplate(tpl, fact.slots),
          `${fact.type}: "${tpl.text}"`,
        ).not.toBeNull();
      }
    }
  });
});
