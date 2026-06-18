"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { generateInviteToken } from "@/lib/invites";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InviteFormState = { ok?: boolean; error?: string; token?: string };

const inviteSchema = z.object({
  note: z.string().trim().max(80).optional().nullable(),
  maxUses: z.preprocess(
    (v) => (v === "" || v == null ? 1 : Number(v)),
    z.number().int().min(1).max(100),
  ),
  expiresInDays: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(1).max(365).nullable(),
  ),
});

export async function createInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const coach = await requireCoach();
  const parsed = inviteSchema.safeParse({
    note: formData.get("note") || null,
    maxUses: formData.get("maxUses"),
    expiresInDays: formData.get("expiresInDays"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const token = generateInviteToken();
  const expiresAt = parsed.data.expiresInDays
    ? new Date(
        Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000,
      ).toISOString()
    : null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("invites").insert({
    token,
    note: parsed.data.note || null,
    max_uses: parsed.data.maxUses,
    expires_at: expiresAt,
    created_by: coach.id,
  });
  if (error) return { error: "Davet oluşturulamadı." };

  revalidatePath("/panel/davetler");
  return { ok: true, token };
}

export async function deleteInvite(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("invites").delete().eq("id", id);
  revalidatePath("/panel/davetler");
}
