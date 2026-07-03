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
  ];
  return found.filter((a): a is TriageAlert => a !== null);
}
