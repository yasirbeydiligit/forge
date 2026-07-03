/**
 * Every triage threshold and score weight in one place. The detectors and the
 * scorer take a config parameter (defaulting to this), so a future coach
 * settings UI can override values without touching the logic.
 */

export type TriageConfig = {
  /* ---- adherence: data ABSENCE ("athlete is slipping away") ---- */
  /** Days without any logged session before a warning fires. */
  workoutGapDays: number;
  /** Days without any logged session before it escalates to critical. */
  workoutGapCriticalDays: number;
  /** Consecutive meal-less days (ending yesterday) before a warning. */
  mealGapDays: number;
  mealGapCriticalDays: number;
  /** Days without a daily_metrics check-in before a warning. */
  checkinGapDays: number;
  checkinGapCriticalDays: number;
  /** 7-day protocol completion rate floors (warning / critical). */
  protocolFloor: number;
  protocolCriticalFloor: number;
  /** Look-back window for the protocol completion rate. */
  protocolWindowDays: number;

  /* ---- performance: data EXISTS but is off ("athlete is struggling") ---- */
  /** Fraction of protein target counted as a hit (mirrors MACRO_FLOOR). */
  proteinFloor: number;
  /** Consecutive LOGGED days below the floor before a warning. */
  proteinLowDays: number;
  /** Weeks the weekly-average weight must move against the goal. */
  weightTrendWeeks: number;
  /** Minimum weekly drift (kg) that counts as movement. */
  weightTrendMinKg: number;
  /** Recent sessions considered for the RIR signal. */
  rirSessions: number;
  /** Average RIR at/above ⇒ "always holding back". */
  rirHighAvg: number;
  /** Average RIR at/below ⇒ "always at failure". */
  rirLowAvg: number;
  /** Minimum RIR-carrying sets across the window for the signal to count. */
  rirMinSets: number;

  /* ---- scoring ---- */
  penalties: {
    adherence: { warning: number; critical: number };
    performance: { warning: number; critical: number };
  };
};

export const DEFAULT_TRIAGE_CONFIG: TriageConfig = {
  workoutGapDays: 3,
  workoutGapCriticalDays: 7,
  mealGapDays: 2,
  mealGapCriticalDays: 5,
  checkinGapDays: 3,
  checkinGapCriticalDays: 7,
  protocolFloor: 0.6,
  protocolCriticalFloor: 0.3,
  protocolWindowDays: 7,

  proteinFloor: 0.9,
  proteinLowDays: 3,
  weightTrendWeeks: 2,
  weightTrendMinKg: 0.3,
  rirSessions: 3,
  rirHighAvg: 3.5,
  rirLowAvg: 0.5,
  rirMinSets: 6,

  penalties: {
    adherence: { warning: 20, critical: 50 },
    performance: { warning: 12, critical: 30 },
  },
};
