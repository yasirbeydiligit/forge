/**
 * Pure category/region filtering + grouping for exercise lists. Shared by the
 * coach library (/panel/egzersizler) and the program-builder exercise picker so
 * both narrow and group exercises the same way (by muscle group + sub-region)
 * instead of one flat alphabetical list. Side-effect free → unit-tested.
 */
import { EXERCISE_CATEGORIES } from "@/lib/constants";

export type FilterableExercise = {
  id: string;
  name: string;
  category: string | null;
  region: string | null;
  is_system?: boolean;
};

/** Display bucket for exercises with no category. */
export const UNCATEGORIZED = "Diğer";

const CATEGORY_ORDER = new Map<string, number>(
  EXERCISE_CATEGORIES.map((c, i) => [c, i]),
);

function categoryRank(category: string): number {
  if (category === UNCATEGORIZED) return Number.MAX_SAFE_INTEGER;
  return CATEGORY_ORDER.get(category) ?? EXERCISE_CATEGORIES.length;
}

function byCategoryThenName(a: string, b: string): number {
  const r = categoryRank(a) - categoryRank(b);
  return r !== 0 ? r : a.localeCompare(b, "tr");
}

/** Categories present in the list, canonical order, the null bucket ("Diğer") last. */
export function exerciseCategories<T extends FilterableExercise>(
  list: T[],
): string[] {
  const present = new Set<string>();
  for (const e of list) present.add(e.category ?? UNCATEGORIZED);
  return [...present].sort(byCategoryThenName);
}

/** Distinct non-null regions present, optionally scoped to one category, tr-sorted. */
export function exerciseRegions<T extends FilterableExercise>(
  list: T[],
  category?: string,
): string[] {
  const present = new Set<string>();
  for (const e of list) {
    if (category && (e.category ?? UNCATEGORIZED) !== category) continue;
    if (e.region) present.add(e.region);
  }
  return [...present].sort((a, b) => a.localeCompare(b, "tr"));
}

/** Filter by optional category (UNCATEGORIZED matches null), region and name query. */
export function filterExercises<T extends FilterableExercise>(
  list: T[],
  opts: { category?: string; region?: string; query?: string },
): T[] {
  const q = opts.query?.trim().toLocaleLowerCase("tr");
  return list.filter((e) => {
    if (opts.category && (e.category ?? UNCATEGORIZED) !== opts.category) {
      return false;
    }
    if (opts.region && e.region !== opts.region) return false;
    if (q && !e.name.toLocaleLowerCase("tr").includes(q)) return false;
    return true;
  });
}

/** Group into ordered { category, items } buckets; items keep their input order. */
export function groupExercisesByCategory<T extends FilterableExercise>(
  list: T[],
): { category: string; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const e of list) {
    const key = e.category ?? UNCATEGORIZED;
    const arr = buckets.get(key) ?? [];
    arr.push(e);
    buckets.set(key, arr);
  }
  return [...buckets.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => byCategoryThenName(a.category, b.category));
}
