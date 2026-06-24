/**
 * Seed a demo athlete with ~2 weeks of logged data shaped to trigger all four
 * insight rules, so the woven-in cited margin notes light up across the app:
 *   - protein_target (protein_per_bw_7d >= 1.6)
 *   - sleep_low      (sleep_hours_7d   <  7)
 *   - volume_progressing (volume_wow_pct > 0)
 *   - rir_low        (rir_7d           <= 2)
 *
 * Idempotent: re-running wipes this athlete's meals / daily_metrics / log_*
 * rows and reinserts them. Standalone tsx script (like src/db/seed.ts).
 *
 * Usage: npm run seed:demo-athlete
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/database.types";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("\n✗ Eksik env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY gerekli.\n");
  process.exit(1);
}

const EMAIL = process.env.DEMO_ATHLETE_EMAIL ?? "sporcu@example.com";
const PASSWORD = process.env.DEMO_ATHLETE_PASSWORD ?? "Forge!2026";
const NAME = process.env.DEMO_ATHLETE_NAME ?? "Demo Sporcu";

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** YYYY-MM-DD for today + offsetDays. */
function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function ensureAthlete(): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: NAME, role: "athlete" },
  });
  let id = created?.user?.id;
  if (error || !id) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === EMAIL);
    if (!existing) throw error ?? new Error("Sporcu kullanıcısı oluşturulamadı.");
    id = existing.id;
    console.log("• Sporcu hesabı zaten mevcut, kullanılıyor.");
  } else {
    console.log("✓ Sporcu hesabı oluşturuldu.");
  }
  await admin
    .from("profiles")
    .upsert({ id, role: "athlete", full_name: NAME }, { onConflict: "id" });
  return id;
}

/** Reuse three existing exercises, creating them if the library is empty. */
async function ensureExercises(athleteId: string): Promise<string[]> {
  const wanted = ["Barbell Squat", "Bench Press", "Deadlift"];
  const { data: existing } = await admin.from("exercises").select("id, name");
  const byName = new Map((existing ?? []).map((e) => [e.name, e.id]));
  const missing = wanted.filter((n) => !byName.has(n));
  if (missing.length) {
    const { data: inserted } = await admin
      .from("exercises")
      .insert(missing.map((name) => ({ name, category: "Demo", created_by: athleteId })))
      .select("id, name");
    for (const e of inserted ?? []) byName.set(e.name, e.id);
  }
  return wanted.map((n) => byName.get(n)!).filter(Boolean) as string[];
}

async function wipe(athleteId: string): Promise<void> {
  await admin.from("meals").delete().eq("athlete_id", athleteId);
  await admin.from("daily_metrics").delete().eq("athlete_id", athleteId);
  // log_sets cascade-delete when their session is removed.
  await admin.from("log_sessions").delete().eq("athlete_id", athleteId);
}

async function seedDailyMetrics(athleteId: string): Promise<void> {
  // 8 days incl. today. Bodyweight ~80kg (latest used for protein/kg); sleep
  // averages ~6.3h over the last 7 days → triggers sleep_low (<7).
  const sleep = [6.1, 6.4, 6.0, 6.6, 6.2, 6.5, 6.3, 6.2];
  const rows = Array.from({ length: 8 }, (_, i) => ({
    athlete_id: athleteId,
    metric_date: dateKey(-i),
    weight: 80 + (i % 2 === 0 ? 0 : 0.2),
    sleep_hours: sleep[i],
    energy: 6,
    hunger: 5,
    adherence: 8,
  }));
  await admin.from("daily_metrics").insert(rows);
}

async function seedMeals(athleteId: string): Promise<void> {
  // 7 days, 3 meals/day, 45g protein each → 135g/day; 135/80 ≈ 1.69 g/kg →
  // triggers protein_target (>=1.6).
  const meals: Database["public"]["Tables"]["meals"]["Insert"][] = [];
  for (let i = 0; i <= 6; i++) {
    const date = dateKey(-i);
    for (const m of [
      { name: "Kahvaltı — yumurta & yulaf", eaten_at: "08:00", kcal: 600 },
      { name: "Öğle — tavuk & pirinç", eaten_at: "13:00", kcal: 750 },
      { name: "Akşam — somon & sebze", eaten_at: "20:00", kcal: 700 },
    ]) {
      meals.push({
        athlete_id: athleteId,
        meal_date: date,
        eaten_at: m.eaten_at,
        name: m.name,
        protein: 45,
        carbs: 60,
        fat: 20,
        kcal: m.kcal,
      });
    }
  }
  await admin.from("meals").insert(meals);
}

async function seedTraining(athleteId: string, exerciseIds: string[]): Promise<void> {
  // Progressive overload: this week heavier than last week (volume_wow_pct > 0),
  // this week's RIR ~1.25 (rir_7d <= 2 → training near failure). 3 sessions/week.
  const weeks = [
    { offsets: [-12, -10, -8], weights: [80, 60, 100], rir: [3.0, 2.5] },
    { offsets: [-5, -3, -1], weights: [90, 67.5, 110], rir: [1.0, 1.5] },
  ];
  for (const wk of weeks) {
    for (const off of wk.offsets) {
      const { data: session } = await admin
        .from("log_sessions")
        .insert({
          athlete_id: athleteId,
          session_date: dateKey(off),
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (!session) continue;
      const sets: Database["public"]["Tables"]["log_sets"]["Insert"][] = [];
      exerciseIds.forEach((exId, ei) => {
        for (let s = 1; s <= 3; s++) {
          sets.push({
            session_id: session.id,
            exercise_id: exId,
            set_number: s,
            weight: wk.weights[ei],
            reps: 5,
            rir: wk.rir[s % wk.rir.length],
          });
        }
      });
      await admin.from("log_sets").insert(sets);
    }
  }
}

async function main() {
  console.log("\n🌱 Demo sporcu tohumlaması başlıyor…\n");
  const athleteId = await ensureAthlete();
  const exerciseIds = await ensureExercises(athleteId);
  await wipe(athleteId);
  await seedDailyMetrics(athleteId);
  await seedMeals(athleteId);
  await seedTraining(athleteId, exerciseIds);

  console.log("\n──────────────────────────────────────────────");
  console.log("✅ Demo sporcu hazır.");
  console.log(`   E-posta: ${EMAIL}  •  Şifre: ${PASSWORD}`);
  console.log(`   athleteId: ${athleteId}`);
  console.log("   8 gün metrik, 7 gün öğün, 6 antrenman seansı.");
  console.log("──────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\n✗ Hata:", err?.message ?? err, "\n");
  process.exit(1);
});
