/**
 * Pure alert detectors for the coach triage board. Two logically separate
 * families feed one list:
 *
 *  - ADHERENCE  — data is MISSING (the athlete is slipping away): workout /
 *    meal / check-in gaps, protocol completion rate.
 *  - PERFORMANCE — data EXISTS but looks bad (the athlete is struggling):
 *    protein streaks, plateaus, weight drifting against the goal, extreme RIR.
 *
 * `today` is injected (ISO yyyy-mm-dd) so everything stays deterministic and
 * unit-testable. Fingerprints identify the alert's data period + severity, so
 * a dismissal survives quiet days but the alert resurfaces when new evidence
 * arrives or the severity escalates.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";

import { detectPlateau } from "@/lib/reports/plateau";

import { DEFAULT_TRIAGE_CONFIG, type TriageConfig } from "./config";
import type { AlertSeverity, TriageAlert, TriageInput } from "./types";

function daysSince(dateIso: string, today: string): number {
  return differenceInCalendarDays(parseISO(today), parseISO(dateIso));
}

function latest(dates: string[]): string | null {
  let max: string | null = null;
  for (const d of dates) if (max === null || d > max) max = d;
  return max;
}

/* -------------------------------------------------------------------------- */
/*  Adherence — data absence                                                  */
/* -------------------------------------------------------------------------- */

function workoutGap(
  input: TriageInput,
  c: TriageConfig,
  today: string,
): TriageAlert | null {
  const last = latest(input.sessionDates);
  const gap = last != null ? daysSince(last, today) : daysSince(input.joinedAt, today);
  if (gap < c.workoutGapDays) return null;

  const severity: AlertSeverity =
    gap >= c.workoutGapCriticalDays ? "critical" : "warning";
  return {
    key: "workout_gap",
    category: "adherence",
    dimension: "training",
    severity,
    titleTr:
      last != null ? `${gap} gündür antrenman yok` : "Hiç antrenman girişi yok",
    detailTr:
      last != null
        ? `Son seans ${last} tarihinde girildi.`
        : "Katıldığından beri logbook boş.",
    fingerprint: `${last ?? "never"}:${severity}`,
    tab: "antrenman",
  };
}

function mealGap(
  input: TriageInput,
  c: TriageConfig,
  today: string,
): TriageAlert | null {
  const last = latest(input.mealDays.map((m) => m.date));
  // Today doesn't count as missed — the day isn't over yet.
  const missed =
    last != null ? daysSince(last, today) - 1 : daysSince(input.joinedAt, today);
  if (missed < c.mealGapDays) return null;

  const severity: AlertSeverity =
    missed >= c.mealGapCriticalDays ? "critical" : "warning";
  return {
    key: "meal_gap",
    category: "adherence",
    dimension: "nutrition",
    severity,
    titleTr: `${missed} gündür öğün kaydı yok`,
    detailTr:
      last != null
        ? `Son öğün ${last} tarihinde loglandı.`
        : "Hiç öğün loglanmamış.",
    fingerprint: `${last ?? "never"}:${severity}`,
    tab: "beslenme",
  };
}

function checkinGap(
  input: TriageInput,
  c: TriageConfig,
  today: string,
): TriageAlert | null {
  const last = latest(input.metricDays.map((m) => m.date));
  const gap = last != null ? daysSince(last, today) : daysSince(input.joinedAt, today);
  if (gap < c.checkinGapDays) return null;

  const severity: AlertSeverity =
    gap >= c.checkinGapCriticalDays ? "critical" : "warning";
  return {
    key: "checkin_gap",
    category: "adherence",
    dimension: "tracking",
    severity,
    titleTr: `${gap} gündür check-in yok`,
    detailTr:
      last != null
        ? `Son günlük takip girişi ${last}.`
        : "Hiç günlük takip girişi yok.",
    fingerprint: `${last ?? "never"}:${severity}`,
    tab: "takip",
  };
}

function protocolLow(
  input: TriageInput,
  c: TriageConfig,
): TriageAlert | null {
  if (input.protocolAssigned <= 0) return null;
  const expected = input.protocolAssigned * c.protocolWindowDays;
  const done = input.protocolCompletions.length;
  const rate = done / expected;
  if (rate >= c.protocolFloor) return null;

  const severity: AlertSeverity =
    rate < c.protocolCriticalFloor ? "critical" : "warning";
  const lastDone = latest(input.protocolCompletions.map((p) => p.date));
  return {
    key: "protocol_low",
    category: "adherence",
    dimension: "protocol",
    severity,
    titleTr: "Protokol uyumu düşük",
    detailTr: `Son ${c.protocolWindowDays} günde ${done}/${expected} tamamlama (%${Math.round(rate * 100)}).`,
    fingerprint: `${lastDone ?? "never"}:${severity}`,
    tab: "beslenme",
  };
}

/* -------------------------------------------------------------------------- */
/*  Performance — data exists but looks bad                                   */
/* -------------------------------------------------------------------------- */

function proteinLow(input: TriageInput, c: TriageConfig): TriageAlert | null {
  const target = input.proteinTarget;
  if (!target || target <= 0) return null;

  // Newest logged day first; unlogged days don't break the streak.
  const logged = [...input.mealDays].sort((a, b) => b.date.localeCompare(a.date));
  const floor = target * c.proteinFloor;
  let streak = 0;
  for (const day of logged) {
    if (day.protein >= floor) break;
    streak += 1;
  }
  if (streak < c.proteinLowDays) return null;

  return {
    key: "protein_low",
    category: "performance",
    dimension: "nutrition",
    severity: "warning",
    titleTr: "Protein hedefin altında",
    detailTr: `Loglanan son ${streak} günde protein ${target} g hedefinin %${Math.round(c.proteinFloor * 100)}'ının altında kaldı.`,
    fingerprint: `${logged[0].date}:${streak}`,
    tab: "beslenme",
  };
}

function plateau(input: TriageInput): TriageAlert | null {
  const stalled: { id: string; name: string; lastDate: string }[] = [];
  for (const [exerciseId, p] of Object.entries(input.plateau)) {
    const result = detectPlateau(p.stats);
    if (!result.stalled) continue;
    stalled.push({
      id: exerciseId,
      name: p.exerciseName,
      lastDate: latest(p.stats.map((s) => s.date)) ?? "",
    });
  }
  if (stalled.length === 0) return null;

  stalled.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const names = stalled.map((s) => s.name);
  const shown = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? ` +${names.length - 3}` : "";
  return {
    key: "plateau",
    category: "performance",
    dimension: "training",
    severity: "warning",
    titleTr: `${stalled.length} egzersizde durgunluk`,
    detailTr: `Son seanslarda ilerleme yok: ${shown}${more}.`,
    fingerprint: stalled.map((s) => `${s.id}:${s.lastDate}`).join(","),
    tab: "antrenman",
  };
}

function weightTrend(
  input: TriageInput,
  c: TriageConfig,
  today: string,
): TriageAlert | null {
  const goal = input.goal;
  if (goal !== "fat_loss" && goal !== "muscle_gain") return null;

  // Weekly average buckets counting back from today: bucket 0 = last 7 days.
  const sums = new Map<number, { total: number; n: number }>();
  let lastWeightDate: string | null = null;
  for (const m of input.metricDays) {
    if (m.weight == null) continue;
    const bucket = Math.floor(daysSince(m.date, today) / 7);
    if (bucket < 0) continue;
    const acc = sums.get(bucket) ?? { total: 0, n: 0 };
    acc.total += m.weight;
    acc.n += 1;
    sums.set(bucket, acc);
    if (lastWeightDate === null || m.date > lastWeightDate) lastWeightDate = m.date;
  }

  // Need weightTrendWeeks consecutive week-over-week drifts, so buckets
  // 0..weightTrendWeeks must all carry data.
  const averages: number[] = [];
  for (let b = 0; b <= c.weightTrendWeeks; b += 1) {
    const acc = sums.get(b);
    if (!acc) return null;
    averages.push(acc.total / acc.n);
  }

  const wrongWay = (newer: number, older: number) =>
    goal === "fat_loss"
      ? newer - older >= c.weightTrendMinKg
      : older - newer >= c.weightTrendMinKg;

  for (let b = 0; b < c.weightTrendWeeks; b += 1) {
    if (!wrongWay(averages[b], averages[b + 1])) return null;
  }

  const direction = goal === "fat_loss" ? "artıyor" : "düşüyor";
  const goalTr = goal === "fat_loss" ? "yağ kaybı" : "kas kazanımı";
  return {
    key: "weight_trend",
    category: "performance",
    dimension: "tracking",
    severity: "warning",
    titleTr: "Kilo hedefe ters yönde",
    detailTr: `Hedef ${goalTr} ama haftalık ortalama kilo ${c.weightTrendWeeks} haftadır ${direction}.`,
    fingerprint: `${goal}:${lastWeightDate}`,
    tab: "takip",
  };
}

function rirExtreme(input: TriageInput, c: TriageConfig): TriageAlert | null {
  const recent = [...input.rirSessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-c.rirSessions);
  if (recent.length < c.rirSessions) return null;

  const totalSets = recent.reduce((n, s) => n + s.setCount, 0);
  if (totalSets < c.rirMinSets) return null;

  const avg =
    recent.reduce((sum, s) => sum + s.avgRir * s.setCount, 0) / totalSets;
  const high = avg >= c.rirHighAvg;
  const low = avg <= c.rirLowAvg;
  if (!high && !low) return null;

  const lastDate = recent[recent.length - 1].date;
  return {
    key: "rir_extreme",
    category: "performance",
    dimension: "training",
    severity: "warning",
    titleTr: "RIR sinyali uç değerde",
    detailTr: high
      ? `Son ${recent.length} seansta ortalama RIR ${avg.toFixed(1)} — sürekli çok temkinli, yük artırılabilir.`
      : `Son ${recent.length} seansta ortalama RIR ${avg.toFixed(1)} — sürekli sınırda, toparlanma riski.`,
    fingerprint: `${lastDate}:${high ? "high" : "low"}`,
    tab: "antrenman",
  };
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export function detectAlerts(
  input: TriageInput,
  config: TriageConfig = DEFAULT_TRIAGE_CONFIG,
  today: string,
): TriageAlert[] {
  const found = [
    workoutGap(input, config, today),
    mealGap(input, config, today),
    checkinGap(input, config, today),
    protocolLow(input, config),
    proteinLow(input, config),
    plateau(input),
    weightTrend(input, config, today),
    rirExtreme(input, config),
  ];
  return found.filter((a): a is TriageAlert => a !== null);
}
