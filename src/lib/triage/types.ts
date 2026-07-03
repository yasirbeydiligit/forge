/**
 * Triage engine vocabulary. The engine is pure: the server loader builds one
 * TriageInput per athlete from batched queries, the detectors turn it into
 * alerts, and the scorer folds alerts into a 0–100 score + traffic-light band.
 *
 * Alerts are DERIVED state — never persisted. The only persisted piece is a
 * coach dismissal keyed by (athleteId, alert key, fingerprint); when the
 * underlying data moves, the fingerprint changes and the alert resurfaces.
 */
import type { PlateauSessionStat } from "@/lib/reports/plateau";

export type AlertCategory = "adherence" | "performance";
export type AlertDimension = "training" | "nutrition" | "tracking" | "protocol";
export type AlertSeverity = "warning" | "critical";

/** Athlete-detail tab an alert links to (?tab=…). */
export type AlertTab = "antrenman" | "beslenme" | "takip";

export type TriageAlert = {
  /** Stable machine slug (e.g. "workout_gap"); dismissals key on it. */
  key: string;
  category: AlertCategory;
  dimension: AlertDimension;
  severity: AlertSeverity;
  titleTr: string;
  detailTr: string;
  /** Identifies the alert's data period; a new period ⇒ a fresh alert. */
  fingerprint: string;
  tab: AlertTab;
};

export type TrainingGoal =
  | "muscle_gain"
  | "strength"
  | "fat_loss"
  | "maintenance";

/** Per-exercise recent session stats feeding the phase-2 plateau detector. */
export type PlateauInput = {
  exerciseName: string;
  stats: PlateauSessionStat[];
};

export type TriageInput = {
  athleteId: string;
  fullName: string;
  avatarUrl: string | null;
  /** profiles.created_at — guards "never logged" alerts on brand-new accounts. */
  joinedAt: string;
  goal: TrainingGoal | null;
  /** Distinct log_sessions dates (ISO yyyy-mm-dd), any completion state. */
  sessionDates: string[];
  /** exerciseId -> recent per-session stats (last ~28 days of exercises). */
  plateau: Record<string, PlateauInput>;
  /** Per-day meal protein sums for logged days only (last ~14 days). */
  mealDays: { date: string; protein: number }[];
  proteinTarget: number | null;
  /** Daily check-in rows (last ~28 days); weight nullable per row. */
  metricDays: { date: string; weight: number | null }[];
  /** Active protocol assignment count. */
  protocolAssigned: number;
  /** One entry per (protocol, day) completion within the last 7 days. */
  protocolCompletions: { date: string }[];
  /** Recent sessions' average logged RIR, newest last. */
  rirSessions: { date: string; avgRir: number; setCount: number }[];
};

export type TriageBand = "green" | "amber" | "red";

export type TriageResult = {
  athleteId: string;
  fullName: string;
  avatarUrl: string | null;
  score: number;
  band: TriageBand;
  /** Open (non-dismissed) alerts, adherence first, critical first within. */
  alerts: TriageAlert[];
  adherenceCount: number;
  performanceCount: number;
  /** Latest activity of any kind (ISO date), null if nothing ever logged. */
  lastActivity: string | null;
};

export type AlertDismissal = {
  athleteId: string;
  alertKey: string;
  fingerprint: string;
};
