/**
 * Pure parsing of the exercise muscle-target payload submitted by the shared
 * exercise form (a hidden `targets` field carrying a JSON array). Kept
 * side-effect free so it is unit-tested in isolation; the create/update server
 * actions consume its output to write `exercise_muscle_targets` rows.
 *
 * Robust by design: anything malformed is dropped rather than thrown, so a
 * corrupt field can never crash the action — the action separately enforces the
 * "at least one primary" product rule on the cleaned list.
 */
export type ExerciseTargetRole = "primary" | "secondary";

export type ExerciseTargetInput = {
  muscleFunctionId: string;
  role: ExerciseTargetRole;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLES = new Set<ExerciseTargetRole>(["primary", "secondary"]);

/**
 * Parse + validate + dedup the targets payload. Accepts a JSON string or an
 * already-parsed array. Invalid entries are skipped; duplicates by
 * muscleFunctionId keep the first occurrence (so primary wins over a later
 * secondary for the same function).
 */
export function parseExerciseTargets(raw: unknown): ExerciseTargetInput[] {
  let value: unknown = raw;
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const out: ExerciseTargetInput[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (entry == null || typeof entry !== "object") continue;
    const id = (entry as Record<string, unknown>).muscleFunctionId;
    const role = (entry as Record<string, unknown>).role;
    if (typeof id !== "string" || !UUID_RE.test(id)) continue;
    if (typeof role !== "string" || !ROLES.has(role as ExerciseTargetRole)) {
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ muscleFunctionId: id, role: role as ExerciseTargetRole });
  }
  return out;
}
