/**
 * Seed script — creates the first coach account, a demo exercise library, a
 * demo program with scheduled workouts, and a reusable test invite.
 *
 * Usage: npm run seed
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../lib/database.types";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

if (!url || !serviceKey) {
  console.error(
    "\n✗ Eksik env. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.\n",
  );
  process.exit(1);
}

const coachEmail = process.env.SEED_COACH_EMAIL ?? "coach@example.com";
const coachPassword = process.env.SEED_COACH_PASSWORD ?? "change-me-please";
const coachName = process.env.SEED_COACH_NAME ?? "Koç";

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function ensureCoach(): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: coachEmail,
    password: coachPassword,
    email_confirm: true,
    user_metadata: { full_name: coachName, role: "coach" },
  });

  let coachId = created?.user?.id;

  if (error || !coachId) {
    // Likely already exists — find the existing user.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === coachEmail);
    if (!existing) throw error ?? new Error("Coach kullanıcısı oluşturulamadı.");
    coachId = existing.id;
    console.log("• Koç hesabı zaten mevcut, kullanılıyor.");
  } else {
    console.log("✓ Koç hesabı oluşturuldu.");
  }

  // Ensure the profile carries the coach role.
  await admin
    .from("profiles")
    .upsert(
      { id: coachId, role: "coach", full_name: coachName },
      { onConflict: "id" },
    );

  return coachId;
}

const EXERCISES: { name: string; category: string; description?: string }[] = [
  { name: "Barbell Squat", category: "Bacak", description: "Sırtta bar, dize kadar çök." },
  { name: "Bench Press", category: "Göğüs", description: "Kontrollü indir, patlayıcı it." },
  { name: "Deadlift", category: "Sırt", description: "Nötr bel, kalçadan kaldır." },
  { name: "Overhead Press", category: "Omuz" },
  { name: "Barbell Row", category: "Sırt" },
  { name: "Pull-up", category: "Sırt" },
  { name: "Romanian Deadlift", category: "Bacak" },
  { name: "Lat Pulldown", category: "Sırt" },
  { name: "Dumbbell Curl", category: "Kol" },
  { name: "Triceps Pushdown", category: "Kol" },
  { name: "Leg Press", category: "Bacak" },
  { name: "Plank", category: "Karın" },
];

async function ensureExercises(coachId: string): Promise<Map<string, string>> {
  const { data: existing } = await admin.from("exercises").select("id, name");
  const byName = new Map<string, string>(
    (existing ?? []).map((e) => [e.name, e.id]),
  );

  const missing = EXERCISES.filter((e) => !byName.has(e.name));
  if (missing.length) {
    const { data: inserted } = await admin
      .from("exercises")
      .insert(
        missing.map((e) => ({
          name: e.name,
          category: e.category,
          description: e.description ?? null,
          created_by: coachId,
        })),
      )
      .select("id, name");
    for (const e of inserted ?? []) byName.set(e.name, e.id);
    console.log(`✓ ${missing.length} egzersiz eklendi.`);
  } else {
    console.log("• Egzersiz kütüphanesi zaten dolu.");
  }
  return byName;
}

const DEMO_PROGRAM = "Başlangıç Gücü — 12 Hafta";

type WeSpec = {
  exercise: string;
  sets?: number;
  repsMin?: number;
  repsMax?: number;
  weight?: number;
  rpe?: number;
  rest?: number;
};
type WorkoutSpec = { name: string; notes?: string; exercises: WeSpec[] };

const WORKOUTS: WorkoutSpec[] = [
  {
    name: "Gün A — İtiş",
    notes: "Göğüs, omuz ve triceps odaklı.",
    exercises: [
      { exercise: "Bench Press", sets: 4, repsMin: 5, repsMax: 5, weight: 60, rest: 150 },
      { exercise: "Overhead Press", sets: 3, repsMin: 6, repsMax: 8, rest: 120 },
      { exercise: "Triceps Pushdown", sets: 3, repsMin: 10, repsMax: 12, rest: 60 },
      { exercise: "Plank", sets: 3, rest: 60 },
    ],
  },
  {
    name: "Gün B — Çekiş",
    notes: "Sırt ve biceps odaklı.",
    exercises: [
      { exercise: "Deadlift", sets: 3, repsMin: 5, repsMax: 5, weight: 100, rpe: 8, rest: 180 },
      { exercise: "Barbell Row", sets: 4, repsMin: 8, repsMax: 8, rest: 120 },
      { exercise: "Lat Pulldown", sets: 3, repsMin: 10, repsMax: 12, rest: 90 },
      { exercise: "Dumbbell Curl", sets: 3, repsMin: 10, repsMax: 12, rest: 60 },
    ],
  },
  {
    name: "Gün C — Bacak",
    notes: "Alt vücut.",
    exercises: [
      { exercise: "Barbell Squat", sets: 5, repsMin: 5, repsMax: 5, weight: 80, rest: 180 },
      { exercise: "Romanian Deadlift", sets: 3, repsMin: 8, repsMax: 10, rest: 120 },
      { exercise: "Leg Press", sets: 3, repsMin: 10, repsMax: 12, rest: 90 },
    ],
  },
];

async function ensureProgram(
  coachId: string,
  exerciseIds: Map<string, string>,
): Promise<void> {
  const { data: existing } = await admin
    .from("programs")
    .select("id")
    .eq("name", DEMO_PROGRAM)
    .maybeSingle();
  if (existing) {
    console.log("• Demo program zaten mevcut, atlanıyor.");
    return;
  }

  const { data: program } = await admin
    .from("programs")
    .insert({
      name: DEMO_PROGRAM,
      description:
        "Yeni başlayanlar için 3 günlük tam vücut güç programı. Bench, squat ve deadlift üzerine kurulu.",
      is_published: true,
      created_by: coachId,
    })
    .select("id")
    .single();
  if (!program) throw new Error("Program oluşturulamadı.");

  const workoutIds: string[] = [];
  for (let i = 0; i < WORKOUTS.length; i++) {
    const spec = WORKOUTS[i];
    const { data: workout } = await admin
      .from("workouts")
      .insert({
        program_id: program.id,
        name: spec.name,
        notes: spec.notes ?? null,
        order_index: i,
      })
      .select("id")
      .single();
    if (!workout) continue;
    workoutIds.push(workout.id);

    await admin.from("workout_exercises").insert(
      spec.exercises
        .filter((e) => exerciseIds.has(e.exercise))
        .map((e, idx) => ({
          workout_id: workout.id,
          exercise_id: exerciseIds.get(e.exercise)!,
          order_index: idx,
          target_sets: e.sets ?? null,
          target_reps_min: e.repsMin ?? null,
          target_reps_max: e.repsMax ?? null,
          target_weight: e.weight ?? null,
          target_rpe: e.rpe ?? null,
          rest_seconds: e.rest ?? null,
        })),
    );
  }

  // Schedule the three workouts across the coming days (program-wide).
  const offsets = [0, 2, 4];
  await admin.from("calendar_assignments").insert(
    workoutIds.map((workoutId, i) => ({
      program_id: program.id,
      workout_id: workoutId,
      scheduled_date: dateKey(offsets[i] ?? i),
      athlete_id: null,
      created_by: coachId,
    })),
  );

  console.log(`✓ Demo program, ${workoutIds.length} antrenman ve takvim atamaları oluşturuldu.`);
}

async function createTestInvite(coachId: string): Promise<string> {
  const token = randomBytes(16).toString("base64url");
  await admin.from("invites").insert({
    token,
    note: "Seed demo daveti",
    max_uses: 10,
    created_by: coachId,
  });
  return token;
}

async function main() {
  console.log("\n🌱 Seed başlıyor…\n");
  const coachId = await ensureCoach();
  const exerciseIds = await ensureExercises(coachId);
  await ensureProgram(coachId, exerciseIds);
  const token = await createTestInvite(coachId);

  console.log("\n──────────────────────────────────────────────");
  console.log("✅ Seed tamamlandı.\n");
  console.log("KOÇ GİRİŞİ:");
  console.log(`  E-posta : ${coachEmail}`);
  console.log(`  Şifre   : ${coachPassword}`);
  console.log("\nTEST DAVET BAĞLANTISI (sporcu kaydı için):");
  console.log(`  ${siteUrl}/kayit?token=${token}`);
  console.log("──────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\n✗ Seed hatası:", err.message ?? err, "\n");
  process.exit(1);
});
