import { cache } from "react";
import { redirect } from "next/navigation";

import type { Tables } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Profile = Tables<"profiles"> & { email: string | null };

/** The authenticated auth user, or null. Memoised per request. */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The current user's profile (with email), or null when signed out. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { ...profile, email: user.email ?? null };
});

/** Require any authenticated profile; redirect to login otherwise. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Require a coach; athletes are bounced to their home. */
export async function requireCoach(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "coach") redirect("/bugun");
  return profile;
}

export function isCoach(profile: Pick<Profile, "role"> | null | undefined) {
  return profile?.role === "coach";
}
