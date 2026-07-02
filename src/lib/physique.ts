/**
 * Physique photo helpers. The images live in the PRIVATE `physique` storage
 * bucket under `{athlete_id}/{uuid}.{ext}`; nothing here ever builds a public
 * URL. Signed URLs are minted with the caller's own JWT client, so the storage
 * SELECT policy (owner folder or coach, 0026) gates minting itself.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export const PHYSIQUE_BUCKET = "physique";
export const SIGNED_URL_TTL_S = 3600;
/** After this many days without a new photo, Bugün nudges for an update. */
export const STALE_AFTER_DAYS = 14;

/** Batch-sign storage paths; returns path → signed URL (misses are dropped). */
export async function signPhysiquePaths(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await supabase.storage
    .from(PHYSIQUE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_S);
  const out = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  }
  return out;
}

/** Whole days between an ISO date and now (0 for today). */
export function daysSince(isoDate: string, today = new Date()): number {
  const then = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(then.getTime())) return 0;
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((midnight.getTime() - then.getTime()) / 86400000));
}
