/**
 * Macro → calorie math. The Atwater factors: 4 kcal/g protein, 4 kcal/g carbs,
 * 9 kcal/g fat. Pure and UI-agnostic so it can be unit-tested and reused by both
 * the meal dialog (live estimate) and template scaling.
 */
type Num = number | null | undefined;

const n = (v: Num): number => (v == null || Number.isNaN(v) ? 0 : v);

/** Estimated calories from macros, rounded to a whole number. */
export function computeKcal(protein: Num, carbs: Num, fat: Num): number {
  return Math.round(n(protein) * 4 + n(carbs) * 4 + n(fat) * 9);
}

/**
 * Whether a manually-entered kcal deviates from the 4/4/9 estimate by more than
 * `tol` (a fraction, default 0.10 = 10%). Returns null when there is nothing to
 * compare: no manual kcal, or macros that produce a zero estimate. This only
 * ever drives a gentle hint — it never blocks saving (fiber / sugar alcohols can
 * legitimately push a label off 4/4/9).
 */
export function kcalMismatch(
  manualKcal: Num,
  protein: Num,
  carbs: Num,
  fat: Num,
  tol = 0.1,
): boolean | null {
  if (manualKcal == null) return null;
  const est = computeKcal(protein, carbs, fat);
  if (est === 0) return null;
  return Math.abs(n(manualKcal) - est) / est > tol;
}

export type Macros = { kcal: Num; protein: Num; carbs: Num; fat: Num };

/** Scale a saved meal by a portion factor; null fields stay null. */
export function scaleMacros(m: Macros, factor: number): {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
} {
  const s = (v: Num) => (v == null ? null : Math.round(v * factor));
  return { kcal: s(m.kcal), protein: s(m.protein), carbs: s(m.carbs), fat: s(m.fat) };
}
