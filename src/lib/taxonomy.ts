/**
 * Exercise-taxonomy display layer.
 *
 * The DB stores canonical machine values in pgEnums (movement_pattern,
 * equipment_type). This module is the single source of their Turkish labels for
 * the UI, plus the lists the CSV importer validates against. Keep the keys here
 * in sync with the pgEnum members in src/db/schema.ts.
 */

export const MOVEMENT_PATTERNS = [
  "push_horizontal",
  "push_vertical",
  "pull_horizontal",
  "pull_vertical",
  "squat",
  "hinge",
  "lunge",
  "isolation",
  "carry",
  "core",
  "rotation",
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const EQUIPMENT_TYPES = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "smith",
  "ez_bar",
  "trap_bar",
  "other",
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

/** Turkish UI labels for movement patterns. */
export const MOVEMENT_PATTERN_LABELS_TR: Record<MovementPattern, string> = {
  push_horizontal: "İtiş — yatay",
  push_vertical: "İtiş — dikey",
  pull_horizontal: "Çekiş — yatay",
  pull_vertical: "Çekiş — dikey",
  squat: "Squat",
  hinge: "Kalça menteşesi (hinge)",
  lunge: "Lunge",
  isolation: "İzolasyon",
  carry: "Taşıma",
  core: "Core",
  rotation: "Rotasyon",
};

/** Turkish UI labels for equipment types. */
export const EQUIPMENT_TYPE_LABELS_TR: Record<EquipmentType, string> = {
  barbell: "Barbell (halter)",
  dumbbell: "Dumbbell",
  machine: "Makine",
  cable: "Kablo (cable)",
  bodyweight: "Vücut ağırlığı",
  kettlebell: "Kettlebell",
  band: "Direnç bandı",
  smith: "Smith makinesi",
  ez_bar: "EZ bar",
  trap_bar: "Trap bar",
  other: "Diğer",
};

export const muscleRoleLabelTr = { primary: "Birincil", secondary: "İkincil" } as const;

/** Shared RIR helper copy (first-use tooltip / caption). */
export const RIR_HELP_TR = "RIR = Yedekte kalan tekrar (0 = tam başarısızlık)";
