/**
 * Pure scoring/sorting layer of the triage engine. The band intentionally
 * derives from the WORST open alert (critical→red, warning→amber, none→green)
 * — a coach reads traffic lights, not arithmetic. The 0–100 score exists to
 * rank athletes within a band and to display a single "durum" figure.
 */
import { DEFAULT_TRIAGE_CONFIG, type TriageConfig } from "./config";
import type {
  AlertDismissal,
  TriageAlert,
  TriageBand,
  TriageInput,
  TriageResult,
} from "./types";

/** Open alerts only: a dismissal hides one exact (key, fingerprint) period. */
export function filterDismissed(
  alerts: TriageAlert[],
  dismissals: AlertDismissal[],
  athleteId: string,
): TriageAlert[] {
  const dismissed = new Set(
    dismissals
      .filter((d) => d.athleteId === athleteId)
      .map((d) => `${d.alertKey}\n${d.fingerprint}`),
  );
  return alerts.filter((a) => !dismissed.has(`${a.key}\n${a.fingerprint}`));
}

function latest(dates: (string | null)[]): string | null {
  let max: string | null = null;
  for (const d of dates) if (d != null && (max === null || d > max)) max = d;
  return max;
}

export function computeTriage(
  input: TriageInput,
  openAlerts: TriageAlert[],
  config: TriageConfig = DEFAULT_TRIAGE_CONFIG,
): TriageResult {
  let penalty = 0;
  let hasCritical = false;
  for (const a of openAlerts) {
    penalty += config.penalties[a.category][a.severity];
    if (a.severity === "critical") hasCritical = true;
  }
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const band: TriageBand =
    openAlerts.length === 0 ? "green" : hasCritical ? "red" : "amber";

  // Adherence first ("bring them back" beats "tune the program"), critical
  // before warning within each category.
  const rank = (a: TriageAlert) =>
    (a.category === "adherence" ? 0 : 2) + (a.severity === "critical" ? 0 : 1);
  const alerts = [...openAlerts].sort((a, b) => rank(a) - rank(b));

  return {
    athleteId: input.athleteId,
    fullName: input.fullName,
    avatarUrl: input.avatarUrl,
    score,
    band,
    alerts,
    adherenceCount: alerts.filter((a) => a.category === "adherence").length,
    performanceCount: alerts.filter((a) => a.category === "performance").length,
    lastActivity: latest([
      latest(input.sessionDates),
      latest(input.mealDays.map((m) => m.date)),
      latest(input.metricDays.map((m) => m.date)),
      latest(input.protocolCompletions.map((p) => p.date)),
    ]),
  };
}

/** Worst first; ties broken by staler activity (never-active counts oldest). */
export function sortTriage(results: TriageResult[]): TriageResult[] {
  return [...results].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const aAct = a.lastActivity ?? "";
    const bAct = b.lastActivity ?? "";
    return aAct.localeCompare(bAct);
  });
}
