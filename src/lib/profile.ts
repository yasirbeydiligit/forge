/**
 * Profile domain registry + pure helpers.
 *
 * Canonical machine values live in the DB enums (see src/db/schema.ts);
 * Turkish display labels live here, same pattern as the exercise taxonomy.
 * Private fields (height/birth date/sex/preferences) are stored in
 * `profile_details`, NOT `profiles` — profiles is community-readable.
 */
import type { Enums } from "@/lib/database.types";

export type TrainingGoalKey = Enums<"training_goal">;
export type SexKey = Enums<"user_sex">;
export type WeightUnitKey = Enums<"weight_unit">;

export const GOAL_OPTIONS: {
  key: TrainingGoalKey;
  label: string;
  /** One-line consequence shown in the picker (what the choice feeds). */
  hint: string;
}[] = [
  { key: "muscle_gain", label: "Kas alımı", hint: "Kilo trendi yukarı okunur" },
  { key: "strength", label: "Güç", hint: "Kilo trendi nötr izlenir" },
  { key: "fat_loss", label: "Yağ kaybı", hint: "Kilo trendi aşağı okunur" },
  { key: "maintenance", label: "Form koruma", hint: "Kilo trendi nötr izlenir" },
];

export const GOAL_LABEL_TR = Object.fromEntries(
  GOAL_OPTIONS.map((g) => [g.key, g.label]),
) as Record<TrainingGoalKey, string>;

export const SEX_OPTIONS: { key: SexKey; label: string }[] = [
  { key: "male", label: "Erkek" },
  { key: "female", label: "Kadın" },
];

export const SEX_LABEL_TR = Object.fromEntries(
  SEX_OPTIONS.map((s) => [s.key, s.label]),
) as Record<SexKey, string>;

export const UNIT_OPTIONS: { key: WeightUnitKey; label: string }[] = [
  { key: "kg", label: "Kilogram (kg)" },
  { key: "lb", label: "Pound (lb)" },
];

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Lowercase/trim a raw handle. Returns null when empty (handle removed), the
 * cleaned handle when valid, or undefined when invalid — the caller picks the
 * error message. Mirrors the DB CHECK `profiles_username_format` (0026).
 */
export function normalizeUsername(
  raw: string | null | undefined,
): string | null | undefined {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "") return null;
  return USERNAME_RE.test(v) ? v : undefined;
}

/** Whole-year age from an ISO `yyyy-MM-dd` birth date, or null when unusable. */
export function ageFrom(
  birthDate: string | null | undefined,
  today = new Date(),
): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}
