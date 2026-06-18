"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { checkInviteToken } from "@/lib/invites";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { error?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
  password: z.string().min(1, "Şifre gerekli."),
  redirectTo: z.string().optional(),
});

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: "E-posta veya şifre hatalı." };
  }

  const target = parsed.data.redirectTo?.startsWith("/")
    ? parsed.data.redirectTo
    : "/";
  redirect(target);
}

const signupSchema = z.object({
  token: z.string().min(1, "Davet kodu eksik."),
  fullName: z.string().min(2, "Ad soyad en az 2 karakter olmalı."),
  email: z.string().email("Geçerli bir e-posta girin."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı."),
});

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const { token, fullName, email, password } = parsed.data;

  const check = await checkInviteToken(token);
  if (!check.valid) return { error: check.reason };

  const admin = createSupabaseAdminClient();

  // Re-read the invite for an up-to-date use count (used in the update below).
  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return { error: "Davet kodu geçersiz." };

  const { data: created, error: createError } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "athlete" },
    },
  );

  if (createError || !created.user) {
    const already = createError?.message?.toLowerCase().includes("already");
    return {
      error: already
        ? "Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin."
        : "Kayıt oluşturulamadı. Lütfen tekrar deneyin.",
    };
  }

  await admin
    .from("invites")
    .update({
      uses: invite.uses + 1,
      used_by: created.user.id,
      used_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    // Account exists; let them log in manually.
    redirect("/login");
  }

  redirect("/bugun");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
