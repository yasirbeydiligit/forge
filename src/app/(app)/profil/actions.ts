"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const schema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı."),
  bio: z.string().trim().max(280).optional().nullable(),
  avatarUrl: z.string().trim().optional().nullable(),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    bio: formData.get("bio") || null,
    avatarUrl: formData.get("avatarUrl") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      bio: parsed.data.bio || null,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", profile.id);
  if (error) return { error: "Profil güncellenemedi." };

  revalidatePath("/profil");
  return { ok: true };
}
