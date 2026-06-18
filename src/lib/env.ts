/**
 * Centralised, validated access to public Supabase configuration.
 * Only NEXT_PUBLIC_* values live here so this module is safe to import from
 * both server and client code. The service-role key is read separately in
 * `@/lib/supabase/admin` (server-only).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Eksik Supabase yapılandırması. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı.",
  );
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  /** Absolute base URL used to build shareable invite links. */
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
} as const;
