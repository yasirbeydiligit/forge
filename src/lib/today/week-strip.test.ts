import { describe, it, expect } from "vitest";

import { buildWeekStrip } from "./week-strip";

// Mon 2026-06-29 .. Sun 2026-07-05, "today" = Wed 2026-07-01.
const DAYS = [
  "2026-06-29",
  "2026-06-30",
  "2026-07-01",
  "2026-07-02",
  "2026-07-03",
  "2026-07-04",
  "2026-07-05",
];
const TODAY = "2026-07-01";

describe("buildWeekStrip", () => {
  it("returns a calm empty week: 7 rest cells, one marked today", () => {
    const cells = buildWeekStrip({
      days: DAYS,
      todayKey: TODAY,
      assignments: [],
      completedDates: [],
    });
    expect(cells).toHaveLength(7);
    expect(cells.every((c) => !c.planned && !c.completed)).toBe(true);
    expect(cells.filter((c) => c.isToday)).toHaveLength(1);
    expect(cells.find((c) => c.isToday)?.date).toBe(TODAY);
  });

  it("marks past days strictly before today", () => {
    const cells = buildWeekStrip({
      days: DAYS,
      todayKey: TODAY,
      assignments: [],
      completedDates: [],
    });
    expect(cells.map((c) => c.isPast)).toEqual([
      true, // Mon 06-29
      true, // Tue 06-30
      false, // Wed 07-01 (today)
      false, // Thu 07-02
      false,
      false,
      false,
    ]);
  });

  it("gathers planned workout names per day, preserving input order", () => {
    const cells = buildWeekStrip({
      days: DAYS,
      todayKey: TODAY,
      assignments: [
        { scheduled_date: "2026-07-02", workout: { name: "İtiş" } },
        { scheduled_date: "2026-07-02", workout: { name: "Bacak" } },
        { scheduled_date: "2026-06-29", workout: { name: "Çekiş" } },
      ],
      completedDates: [],
    });
    const thu = cells.find((c) => c.date === "2026-07-02")!;
    expect(thu.planned).toBe(true);
    expect(thu.workoutNames).toEqual(["İtiş", "Bacak"]);
    const mon = cells.find((c) => c.date === "2026-06-29")!;
    expect(mon.workoutNames).toEqual(["Çekiş"]);
  });

  it("marks a day completed when a completed session lands on it, even if also planned", () => {
    const cells = buildWeekStrip({
      days: DAYS,
      todayKey: TODAY,
      assignments: [{ scheduled_date: "2026-06-30", workout: { name: "İtiş" } }],
      completedDates: ["2026-06-30", "2026-06-29"],
    });
    const tue = cells.find((c) => c.date === "2026-06-30")!;
    expect(tue.completed).toBe(true);
    expect(tue.planned).toBe(true);
    // A free/completed day with no plan is still marked done.
    const mon = cells.find((c) => c.date === "2026-06-29")!;
    expect(mon.completed).toBe(true);
    expect(mon.planned).toBe(false);
  });

  it("ignores a null workout on an assignment", () => {
    const cells = buildWeekStrip({
      days: DAYS,
      todayKey: TODAY,
      assignments: [{ scheduled_date: "2026-07-01", workout: null }],
      completedDates: [],
    });
    const today = cells.find((c) => c.isToday)!;
    expect(today.planned).toBe(true);
    expect(today.workoutNames).toEqual([]);
  });
});
