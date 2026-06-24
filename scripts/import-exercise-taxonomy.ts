/**
 * Import scripts/exercise-taxonomy.csv into the database.
 *
 * Idempotent: upserts exercises on `slug` (marking them is_system=true),
 * replaces each exercise's muscle targets, and links manual alternatives. Uses
 * the service-role client (bypasses RLS), mirroring src/db/seed.ts.
 *
 * Usage:
 *   npm run seed:taxonomy            apply the CSV
 *   npm run seed:taxonomy -- --dry   parse + validate only, write nothing
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local,
 * and the 0013–0015 migrations to be applied (muscles/functions must exist).
 *
 * The taxonomy tables are not in the hand-maintained database.types.ts yet
 * (regenerate it after applying the migration), so this maintenance script uses
 * an untyped service-role client.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { parseTaxonomyCsv } from "../src/lib/taxonomy-csv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n✗ Eksik env. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.\n",
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry");
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CSV_PATH = resolve(process.cwd(), "scripts/exercise-taxonomy.csv");

async function main(): Promise<void> {
  const rows = parseTaxonomyCsv(readFileSync(CSV_PATH, "utf8"));
  console.log(`• CSV ayrıştırıldı: ${rows.length} egzersiz.`);

  // 1) Resolve muscle_function slugs -> ids and validate every reference.
  const { data: fnRows, error: fnErr } = await admin
    .from("muscle_functions")
    .select("id, slug");
  if (fnErr) throw fnErr;
  const fnId = new Map<string, string>(
    (fnRows ?? []).map((r: { id: string; slug: string }) => [r.slug, r.id]),
  );

  const unknownFns = new Set<string>();
  for (const r of rows) {
    for (const fn of [...r.primary, ...r.secondary]) {
      if (!fnId.has(fn)) unknownFns.add(fn);
    }
  }
  if (unknownFns.size > 0) {
    console.error(
      `\n✗ Bilinmeyen kas-fonksiyon slug'ları (0015 seed'inde yok): ${[...unknownFns].join(", ")}\n`,
    );
    process.exit(1);
  }

  // Alternatives must reference another CSV row; warn (don't fail) otherwise.
  const csvSlugs = new Set(rows.map((r) => r.slug));
  for (const r of rows) {
    for (const alt of r.alternatives) {
      if (!csvSlugs.has(alt)) {
        console.warn(`  ! ${r.slug}: muadil '${alt}' CSV'de yok, atlanıyor.`);
      }
    }
  }

  if (dryRun) {
    console.log("\n✓ Dry run — her şey geçerli, hiçbir şey yazılmadı.\n");
    return;
  }

  // 2) Upsert exercises on slug (system exercises).
  const { data: upserted, error: exErr } = await admin
    .from("exercises")
    .upsert(
      rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        category: r.category,
        region: r.region,
        description: r.description,
        video_url: r.videoUrl,
        movement_pattern: r.movementPattern,
        equipment_type: r.equipmentType,
        is_system: true,
      })),
      { onConflict: "slug" },
    )
    .select("id, slug");
  if (exErr) throw exErr;
  const exId = new Map<string, string>(
    (upserted ?? []).map((r: { id: string; slug: string }) => [r.slug, r.id]),
  );
  console.log(`• Egzersizler upsert edildi: ${exId.size}.`);

  // 3) Replace muscle targets for these exercises (idempotent rebuild).
  const exIds = [...exId.values()];
  const { error: delErr } = await admin
    .from("exercise_muscle_targets")
    .delete()
    .in("exercise_id", exIds);
  if (delErr) throw delErr;

  const targets: {
    exercise_id: string;
    muscle_function_id: string;
    role: "primary" | "secondary";
  }[] = [];
  for (const r of rows) {
    const id = exId.get(r.slug)!;
    // Dedup by muscle_function_id within the exercise (unique constraint);
    // primary wins over secondary, and repeats inside a list are collapsed.
    const seen = new Set<string>();
    for (const fn of r.primary) {
      const fid = fnId.get(fn)!;
      if (seen.has(fid)) continue;
      seen.add(fid);
      targets.push({ exercise_id: id, muscle_function_id: fid, role: "primary" });
    }
    for (const fn of r.secondary) {
      const fid = fnId.get(fn)!;
      if (seen.has(fid)) continue;
      seen.add(fid);
      targets.push({ exercise_id: id, muscle_function_id: fid, role: "secondary" });
    }
  }
  if (targets.length > 0) {
    const { error } = await admin.from("exercise_muscle_targets").insert(targets);
    if (error) throw error;
  }
  console.log(`• Kas hedefleri eklendi: ${targets.length}.`);

  // 4) Link manual alternatives (single direction; lookups treat as symmetric).
  const alts: { exercise_id: string; alternative_id: string }[] = [];
  for (const r of rows) {
    const id = exId.get(r.slug)!;
    for (const altSlug of r.alternatives) {
      const altId = exId.get(altSlug);
      if (!altId || altId === id) continue;
      alts.push({ exercise_id: id, alternative_id: altId });
    }
  }
  if (alts.length > 0) {
    const { error } = await admin
      .from("exercise_alternatives")
      .upsert(alts, { onConflict: "exercise_id,alternative_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  console.log(`• Muadil bağlantıları: ${alts.length}.`);
  console.log("\n✓ Taksonomi import tamamlandı.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
