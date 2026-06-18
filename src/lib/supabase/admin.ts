import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Privileged Supabase client using the service-role key. Bypasses RLS, so it
 * MUST only ever be used in trusted server code (invite validation, admin user
 * creation, seeding). Never import this from client components.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Eksik servis anahtarı. .env.local içinde SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı (Supabase Dashboard → Project Settings → API).",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
