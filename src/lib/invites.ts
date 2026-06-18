import "server-only";

import { randomBytes } from "crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InviteCheck =
  | { valid: true; note: string | null }
  | { valid: false; reason: string };

/** Validate an invite token using the privileged client (bypasses RLS). */
export async function checkInviteToken(token: string): Promise<InviteCheck> {
  if (!token) return { valid: false, reason: "Davet kodu eksik." };

  const admin = createSupabaseAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { valid: false, reason: "Davet kodu geçersiz." };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { valid: false, reason: "Bu davetin süresi dolmuş." };
  }
  if (invite.uses >= invite.max_uses) {
    return { valid: false, reason: "Bu davet daha önce kullanılmış." };
  }
  return { valid: true, note: invite.note };
}

/** Generate a URL-safe invite token. */
export function generateInviteToken(): string {
  return randomBytes(16).toString("base64url");
}
