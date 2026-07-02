"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { PHYSIQUE_BUCKET } from "@/lib/physique";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

const addSchema = z.object({
  photoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih geçersiz."),
  storagePath: z.string().min(1, "Önce fotoğraf yüklenmeli."),
  note: z.string().trim().max(280).optional().nullable(),
  weightKg: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .min(20, "Kilo 20–300 kg aralığında olmalı.")
      .max(300, "Kilo 20–300 kg aralığında olmalı.")
      .nullable(),
  ),
});

export async function addPhysiquePhoto(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = addSchema.safeParse({
    photoDate: formData.get("photoDate"),
    storagePath: formData.get("storagePath"),
    note: formData.get("note") || null,
    weightKg: formData.get("weightKg"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  // The storage INSERT policy already forces uploads into the caller's own
  // folder; reject foreign paths here too so a crafted form can't link one.
  if (!d.storagePath.startsWith(`${profile.id}/`)) {
    return { error: "Fotoğraf yolu geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("physique_photos").insert({
    athlete_id: profile.id,
    photo_date: d.photoDate,
    storage_path: d.storagePath,
    note: d.note || null,
    weight_kg: d.weightKg,
  });
  if (error) {
    // Don't leave an orphan object behind when the row fails.
    await supabase.storage.from(PHYSIQUE_BUCKET).remove([d.storagePath]);
    return { error: "Fotoğraf kaydedilemedi. Tekrar deneyin." };
  }

  revalidatePath("/fizik");
  revalidatePath("/bugun");
  return { ok: true };
}

export async function deletePhysiquePhoto(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("physique_photos")
    .select("id, athlete_id, storage_path")
    .eq("id", id.data)
    .maybeSingle();
  // Coach can SELECT athlete rows, so ownership must be re-checked before
  // destructive work (RLS would block the delete anyway; fail loudly earlier).
  if (!row || row.athlete_id !== profile.id) return;

  await supabase.storage.from(PHYSIQUE_BUCKET).remove([row.storage_path]);
  await supabase.from("physique_photos").delete().eq("id", row.id);

  revalidatePath("/fizik");
  revalidatePath("/bugun");
}
