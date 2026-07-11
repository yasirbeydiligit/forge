import { describe, expect, it } from "vitest";

import {
  duePeriods,
  nextMilestone,
  periodKey,
  periodLabel,
  WEEKLY_BACKFILL_LIMIT,
} from "./periods";

describe("duePeriods — weekly", () => {
  it("kapalı ISO haftalarını Pzt–Paz döndürür, devam eden haftayı asla", () => {
    // journeyStart Salı 30 Haz → ilk hafta Pzt 29 Haz'a hizalanır.
    const due = duePeriods("2026-06-30", "2026-07-11", new Set());
    const weekly = due.filter((p) => p.type === "weekly");
    expect(weekly).toEqual([
      { type: "weekly", start: "2026-06-29", end: "2026-07-05" },
    ]); // 6–12 Tem haftası 11'inde hâlâ açık
  });

  it("Pazar günü hafta hâlâ açıktır (end < today şartı)", () => {
    const due = duePeriods("2026-06-29", "2026-07-05", new Set());
    expect(due.filter((p) => p.type === "weekly")).toHaveLength(0);
  });

  it("Pazartesi günü önceki hafta kapanmıştır", () => {
    const due = duePeriods("2026-06-29", "2026-07-06", new Set());
    expect(due.filter((p) => p.type === "weekly")).toEqual([
      { type: "weekly", start: "2026-06-29", end: "2026-07-05" },
    ]);
  });

  it("haftalık backfill son 8 kapalı haftayla sınırlı, kronolojik sırada", () => {
    const due = duePeriods("2025-07-01", "2026-07-11", new Set());
    const weekly = due.filter((p) => p.type === "weekly");
    expect(weekly).toHaveLength(WEEKLY_BACKFILL_LIMIT);
    expect(weekly[0]).toEqual({
      type: "weekly",
      start: "2026-05-11",
      end: "2026-05-17",
    });
    expect(weekly[7]).toEqual({
      type: "weekly",
      start: "2026-06-29",
      end: "2026-07-05",
    });
  });

  it("basılmış hafta elenir; pencere dışına düşen eski hafta asla due olmaz", () => {
    const printed = new Set(["weekly:2026-07-05"]);
    const due = duePeriods("2025-07-01", "2026-07-11", printed);
    const weekly = due.filter((p) => p.type === "weekly");
    // 8'lik pencereden basılı olan düşer, yerine daha eski hafta GELMEZ.
    expect(weekly).toHaveLength(WEEKLY_BACKFILL_LIMIT - 1);
    expect(weekly.some((w) => w.end === "2026-07-05")).toBe(false);
    expect(weekly[0].start).toBe("2026-05-11");
  });
});

describe("duePeriods — monthly", () => {
  it("kapalı takvim aylarını tam backfill'ler, devam eden ayı vermez", () => {
    const due = duePeriods("2026-04-15", "2026-07-11", new Set());
    const monthly = due.filter((p) => p.type === "monthly");
    expect(monthly).toEqual([
      { type: "monthly", start: "2026-04-01", end: "2026-04-30" },
      { type: "monthly", start: "2026-05-01", end: "2026-05-31" },
      { type: "monthly", start: "2026-06-01", end: "2026-06-30" },
    ]);
  });

  it("ayın son günü ay hâlâ açıktır", () => {
    const due = duePeriods("2026-06-01", "2026-06-30", new Set());
    expect(due.filter((p) => p.type === "monthly")).toHaveLength(0);
  });
});

describe("duePeriods — milestone", () => {
  it("dolmuş milestone'ları verir; period_start hep yolculuk başı", () => {
    const due = duePeriods("2025-12-20", "2026-07-11", new Set());
    const ms = due.filter((p) => p.type === "milestone");
    expect(ms).toEqual([
      { type: "milestone", start: "2025-12-20", end: "2026-03-20", months: 3 },
      { type: "milestone", start: "2025-12-20", end: "2026-06-20", months: 6 },
    ]);
  });

  it("milestone günü dolduğu gün due olur (end <= today)", () => {
    const due = duePeriods("2025-12-20", "2026-03-20", new Set());
    const ms = due.filter((p) => p.type === "milestone");
    expect(ms.map((m) => m.months)).toEqual([3]);
  });

  it("ay sonu kenarı: 30 Kas + 3 ay = 28 Şub (date-fns clamp)", () => {
    const due = duePeriods("2025-11-30", "2026-03-05", new Set());
    const ms = due.filter((p) => p.type === "milestone");
    expect(ms[0].end).toBe("2026-02-28");
  });

  it("12'den sonra yıl dönümleri: 24, 36…", () => {
    const due = duePeriods("2024-01-10", "2026-02-01", new Set());
    const months = due
      .filter((p) => p.type === "milestone")
      .map((p) => (p.type === "milestone" ? p.months : 0));
    expect(months).toEqual([3, 6, 9, 12, 24]);
  });

  it("basılmış milestone elenir", () => {
    const printed = new Set(["milestone:2026-03-20"]);
    const due = duePeriods("2025-12-20", "2026-07-11", printed);
    const ms = due.filter((p) => p.type === "milestone");
    expect(ms.map((m) => (m.type === "milestone" ? m.months : 0))).toEqual([6]);
  });
});

describe("duePeriods — sıralama ve anahtar", () => {
  it("tüm tipler kronolojik (end asc) tek listede", () => {
    const due = duePeriods("2026-03-20", "2026-07-11", new Set());
    const ends = due.map((p) => p.end);
    expect([...ends].sort()).toEqual(ends);
  });

  it("periodKey type:end üretir", () => {
    expect(
      periodKey({ type: "weekly", start: "2026-06-29", end: "2026-07-05" }),
    ).toBe("weekly:2026-07-05");
  });
});

describe("periodLabel / nextMilestone", () => {
  it("haftalık etiket gün aralığı", () => {
    expect(
      periodLabel({ type: "weekly", start: "2026-06-29", end: "2026-07-05" }),
    ).toBe("29 Haziran – 5 Temmuz 2026");
  });

  it("aylık etiket ay adı", () => {
    expect(
      periodLabel({ type: "monthly", start: "2026-06-01", end: "2026-06-30" }),
    ).toBe("Haziran 2026");
  });

  it("milestone etiket özel sayı", () => {
    expect(
      periodLabel({
        type: "milestone",
        start: "2025-12-20",
        end: "2026-06-20",
        months: 6,
      }),
    ).toBe("6. Ay Özel Sayısı");
  });

  it("sonraki milestone", () => {
    expect(nextMilestone("2025-12-20", "2026-06-20")).toEqual({
      months: 9,
      dueDate: "2026-09-20",
    });
  });

  it("12'den sonra sonraki yıl dönümü", () => {
    expect(nextMilestone("2024-01-10", "2026-02-01")).toEqual({
      months: 36,
      dueDate: "2027-01-10",
    });
  });
});
