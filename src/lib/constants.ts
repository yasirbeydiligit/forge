/** Muscle-group / movement categories used for the exercise library. */
export const EXERCISE_CATEGORIES = [
  "Göğüs",
  "Sırt",
  "Omuz",
  "Bacak",
  "Kol",
  "Karın",
  "Kalça",
  "Kardiyo",
  "Tüm Vücut",
  "Mobilite",
] as const;

export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const APP_NAME = "Forge";
export const APP_TAGLINE = "Antrenman platformu";
